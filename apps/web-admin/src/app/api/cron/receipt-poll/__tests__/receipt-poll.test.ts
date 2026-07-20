/**
 * @jest-environment node
 *
 * Tests for POST /api/cron/receipt-poll
 *
 * Covers NOTIF-06 receipt polling:
 *  - Test 1: no/wrong auth header → 401, no DB queries
 *  - Test 2: no pending rows → 200 { polled: 0 }, Expo fetch never called
 *  - Test 3: receipt status 'ok' → log row updated to 'delivered'
 *  - Test 4: receipt status 'error' (non-DNR) → row updated to 'failed', device_tokens untouched
 *  - Test 5: receipt error details.error === 'DeviceNotRegistered' → row 'failed' AND device_tokens active=false
 *  - Test 6: receipt ID missing from Expo response → row left as 'sent' (still pending)
 *  - Test 7: response shape { polled, delivered, failed, tokens_deactivated }
 */

import { NextRequest } from 'next/server';

// ─── Mock global fetch ─────────────────────────────────────
let mockFetchResponse: Record<string, unknown> = {};
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Supabase mock state ───────────────────────────────────
// notification_log pending rows returned by select
let mockPendingRows: Array<{
  id: string;
  expo_receipt_id: string;
  profile_id: string;
}> = [];

// Track update calls: notification_log
const mockNotifUpdateEqFn = jest.fn().mockResolvedValue({ error: null });
const mockNotifUpdateEq = jest.fn(() => ({ eq: mockNotifUpdateEqFn }));
const mockNotifUpdate = jest.fn(() => ({ eq: mockNotifUpdateEq }));

// Track update calls: device_tokens
const mockTokenUpdateEq2Fn = jest.fn().mockResolvedValue({ error: null });
const mockTokenUpdateEq1 = jest.fn(() => ({
  eq: jest.fn(() => ({ eq: mockTokenUpdateEq2Fn })),
}));
const mockTokenUpdate = jest.fn(() => ({ eq: mockTokenUpdateEq1 }));

// Track select calls so we can assert no DB queries on auth failure
const mockNotifSelect = jest.fn();

function buildTableChain(table: string) {
  if (table === 'notification_log') {
    return {
      select: mockNotifSelect.mockReturnValue({
        eq: jest.fn(() => ({
          not: jest.fn(() => ({
            gt: jest.fn(() => ({
              lt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({ data: mockPendingRows, error: null }),
                })),
              })),
            })),
          })),
        })),
      }),
      update: mockNotifUpdate,
    };
  }
  if (table === 'device_tokens') {
    return {
      update: mockTokenUpdate,
    };
  }
  return {};
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => buildTableChain(table)),
  })),
}));

// ─── Helpers ───────────────────────────────────────────────
function makeRequest(key?: string, useBearer = false) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key !== undefined) {
    if (useBearer) {
      headers['authorization'] = `Bearer ${key}`;
    } else {
      headers['x-smartgym-internal-key'] = key;
    }
  }
  return new NextRequest('http://localhost/api/cron/receipt-poll', {
    method: 'POST',
    headers,
  });
}

function makeExpoReceiptsResponse(
  data: Record<string, { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } }>
) {
  return {
    ok: true,
    json: async () => ({ data }),
  };
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();

  // Reset env
  process.env.SMARTGYM_INTERNAL_KEY = 'test-internal-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';

  // Reset pending rows
  mockPendingRows = [];

  // Default mock fetch returns empty data
  mockFetchResponse = {};
  mockFetch.mockResolvedValue(makeExpoReceiptsResponse({}));

  // Reset update mocks
  mockNotifUpdateEqFn.mockResolvedValue({ error: null });
  mockTokenUpdateEq2Fn.mockResolvedValue({ error: null });
});

// ─── Test 1: Auth ─────────────────────────────────────────
describe('POST /api/cron/receipt-poll — auth', () => {
  test('no auth header → 401, no DB queries', async () => {
    const req = makeRequest(undefined);
    const res = await POST(req);

    expect(res.status).toBe(401);
    // DB should not have been touched
    expect(mockNotifSelect).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('wrong key → 401', async () => {
    const req = makeRequest('wrong-key');
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockNotifSelect).not.toHaveBeenCalled();
  });

  test('valid x-smartgym-internal-key → 200', async () => {
    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test('valid Authorization Bearer (service-role key) → 200', async () => {
    const req = makeRequest('test-service-role', true);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ─── Test 2: No pending rows ──────────────────────────────
describe('POST /api/cron/receipt-poll — no pending rows', () => {
  test('empty pending select → 200 { polled: 0 }, Expo fetch never called', async () => {
    // mockPendingRows stays []
    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.polled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Test 3: Receipt status 'ok' → 'delivered' ──────────
describe('POST /api/cron/receipt-poll — ok receipt', () => {
  test("receipt status 'ok' → notification_log row updated to 'delivered'", async () => {
    mockPendingRows = [
      { id: 'log-1', expo_receipt_id: 'receipt-abc', profile_id: 'profile-1' },
    ];

    mockFetch.mockResolvedValue(
      makeExpoReceiptsResponse({
        'receipt-abc': { status: 'ok' },
      })
    );

    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.delivered).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.tokens_deactivated).toBe(0);

    // notification_log updated to 'delivered'
    expect(mockNotifUpdate).toHaveBeenCalledWith({ status: 'delivered' });
    // device_tokens NOT touched
    expect(mockTokenUpdate).not.toHaveBeenCalled();
  });
});

// ─── Test 4: Receipt status 'error' (non-DNR) ────────────
describe('POST /api/cron/receipt-poll — error receipt (non-DNR)', () => {
  test("receipt status 'error' non-DeviceNotRegistered → row 'failed', device_tokens untouched", async () => {
    mockPendingRows = [
      { id: 'log-2', expo_receipt_id: 'receipt-xyz', profile_id: 'profile-2' },
    ];

    mockFetch.mockResolvedValue(
      makeExpoReceiptsResponse({
        'receipt-xyz': {
          status: 'error',
          message: 'ExponentPushToken is not valid',
          details: { error: 'InvalidCredentials' },
        },
      })
    );

    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.delivered).toBe(0);
    expect(body.tokens_deactivated).toBe(0);

    // notification_log updated to 'failed'
    expect(mockNotifUpdate).toHaveBeenCalledWith({ status: 'failed' });
    // device_tokens NOT touched
    expect(mockTokenUpdate).not.toHaveBeenCalled();
  });
});

// ─── Test 5: DeviceNotRegistered → deactivate token ──────
describe('POST /api/cron/receipt-poll — DeviceNotRegistered', () => {
  test('DeviceNotRegistered → row failed AND device_tokens active=false for profile_id', async () => {
    mockPendingRows = [
      { id: 'log-3', expo_receipt_id: 'receipt-dnr', profile_id: 'profile-3' },
    ];

    mockFetch.mockResolvedValue(
      makeExpoReceiptsResponse({
        'receipt-dnr': {
          status: 'error',
          message: 'The device cannot receive push notifications',
          details: { error: 'DeviceNotRegistered' },
        },
      })
    );

    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.tokens_deactivated).toBe(1);

    // notification_log updated to 'failed'
    expect(mockNotifUpdate).toHaveBeenCalledWith({ status: 'failed' });
    // device_tokens updated: active=false WHERE profile_id='profile-3' AND active=true
    expect(mockTokenUpdate).toHaveBeenCalledWith({ active: false });
  });
});

// ─── Test 6: Receipt ID missing from Expo response ────────
describe('POST /api/cron/receipt-poll — missing receipt ID in response', () => {
  test('receipt ID absent from Expo response → row left as sent (still pending)', async () => {
    mockPendingRows = [
      { id: 'log-4', expo_receipt_id: 'receipt-pending', profile_id: 'profile-4' },
    ];

    // Expo returns empty data (receipt-pending not in response)
    mockFetch.mockResolvedValue(makeExpoReceiptsResponse({}));

    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.polled).toBe(1);
    expect(body.delivered).toBe(0);
    expect(body.failed).toBe(0);

    // notification_log must NOT be updated
    expect(mockNotifUpdate).not.toHaveBeenCalled();
    // device_tokens NOT touched
    expect(mockTokenUpdate).not.toHaveBeenCalled();
  });
});

// ─── Test 7: Response shape ───────────────────────────────
describe('POST /api/cron/receipt-poll — response shape', () => {
  test('response always includes polled, delivered, failed, tokens_deactivated', async () => {
    const req = makeRequest('test-internal-key');
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('polled');
    expect(body).toHaveProperty('delivered');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('tokens_deactivated');
  });
});
