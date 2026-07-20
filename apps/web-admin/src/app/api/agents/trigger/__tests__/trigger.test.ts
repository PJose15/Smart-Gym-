/**
 * @jest-environment node
 *
 * Tests for POST /api/agents/trigger
 *
 * Covers:
 *  - AGENT-01: Forwarding to UPTIMIZE_WEBHOOK_URL with failure recording
 *  - AGENT-02: Cooldown dedup per (gym, agent, event[, member][, dedup_key])
 *              + is_agent_initiated / dedup_key schema
 *              + platform events tier-bypass
 *
 * Mocks:
 *  - @supabase/supabase-js createClient (chainable query builder)
 *  - @/lib/billing/featureGate checkAgentAccess
 */

import { NextRequest } from 'next/server';

// ─── Mock featureGate ─────────────────────────────────────
const mockCheckAgentAccess = jest.fn();
jest.mock('@/lib/billing/featureGate', () => ({
  checkAgentAccess: (...args: unknown[]) => mockCheckAgentAccess(...args),
}));

// ─── Supabase mock ────────────────────────────────────────
// We need a chainable builder that supports:
//   admin.from('smartgym_agent_logs')
//     .select(...)  -- cooldown dedup query
//     .eq(...)...limit(1)  => returns { data: [] | [row] }
//     .insert({...})  -- inserts (skipped or sent)
//     .insert({...}).select('id').single()  -- returns { data: { id }, error }
//     .update({...}).eq(...)  -- failure recording
const mockSupabaseInsertSingle = jest.fn();
const mockSupabaseInsertSelect = jest.fn(() => ({ single: mockSupabaseInsertSingle }));
const mockSupabaseInsert = jest.fn(() => ({
  select: mockSupabaseInsertSelect,
}));
const mockSupabaseUpdateEq = jest.fn();
const mockSupabaseUpdate = jest.fn(() => ({ eq: mockSupabaseUpdateEq }));

// Dedup query chain
const mockDedupLimit = jest.fn();
const mockDedupIs = jest.fn(() => ({ limit: mockDedupLimit }));
const mockDedupEq4 = jest.fn(() => ({ eq: mockDedupEq5, is: mockDedupIs, limit: mockDedupLimit }));
const mockDedupEq5 = jest.fn(() => ({ limit: mockDedupLimit }));
const mockDedupGte = jest.fn(() => ({ eq: mockDedupEq4, is: mockDedupIs, limit: mockDedupLimit }));
const mockDedupEq3 = jest.fn(() => ({ gte: mockDedupGte }));
const mockDedupEq2 = jest.fn(() => ({ eq: mockDedupEq3 }));
const mockDedupEq1 = jest.fn(() => ({ eq: mockDedupEq2 }));
const mockDedupSelect = jest.fn(() => ({ eq: mockDedupEq1 }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'smartgym_agent_logs') {
        return {
          select: mockDedupSelect,
          insert: mockSupabaseInsert,
          update: mockSupabaseUpdate,
        };
      }
      return {};
    }),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────
function makeRequest(body: unknown, key = 'test-internal-key') {
  return new NextRequest('http://localhost/api/agents/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-smartgym-internal-key': key,
    },
    body: JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default env
  process.env.INTERNAL_WEBHOOK_KEY = 'test-internal-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  delete process.env.UPTIMIZE_WEBHOOK_URL;
  delete process.env.UPTIMIZE_API_KEY;

  // Default: feature access granted
  mockCheckAgentAccess.mockResolvedValue({ hasAccess: true });

  // Default: dedup returns empty (not within cooldown)
  mockDedupLimit.mockResolvedValue({ data: [], error: null });

  // Default: insert returns a row id
  mockSupabaseInsertSingle.mockResolvedValue({ data: { id: 'log-row-id-1' }, error: null });

  // Default: skipped insert (no .select needed) resolves
  mockSupabaseInsert.mockReturnValue({
    select: mockSupabaseInsertSelect,
  });
});

// ─── Pure cooldown module tests ───────────────────────────
describe('cooldown.ts pure functions', () => {
  let getCooldownWindowStart: (event: string, now?: Date) => string;
  let isPlatformEvent: (event: string) => boolean;

  beforeAll(async () => {
    const mod = await import('../cooldown');
    getCooldownWindowStart = mod.getCooldownWindowStart;
    isPlatformEvent = mod.isPlatformEvent;
  });

  test('level-up returns now - 24h', () => {
    const now = new Date('2026-07-01T12:00:00Z');
    const result = getCooldownWindowStart('level-up', now);
    const expected = new Date('2026-06-30T12:00:00Z').toISOString();
    expect(result).toBe(expected);
  });

  test('member-at-risk returns now - 7 days', () => {
    const now = new Date('2026-07-08T12:00:00Z');
    const result = getCooldownWindowStart('member-at-risk', now);
    const expected = new Date('2026-07-01T12:00:00Z').toISOString();
    expect(result).toBe(expected);
  });

  test('unknown event returns now - 60min (DEFAULT)', () => {
    const now = new Date('2026-07-01T12:00:00Z');
    const result = getCooldownWindowStart('some-unknown-event', now);
    const expected = new Date('2026-07-01T11:00:00Z').toISOString();
    expect(result).toBe(expected);
  });

  test('isPlatformEvent: new-gym-onboarded === true', () => {
    expect(isPlatformEvent('new-gym-onboarded')).toBe(true);
  });

  test('isPlatformEvent: upgrade-opportunity === true', () => {
    expect(isPlatformEvent('upgrade-opportunity')).toBe(true);
  });

  test('isPlatformEvent: level-up === false', () => {
    expect(isPlatformEvent('level-up')).toBe(false);
  });

  test('isPlatformEvent: leaderboard-updated === false', () => {
    expect(isPlatformEvent('leaderboard-updated')).toBe(false);
  });
});

// ─── Route dedup tests ────────────────────────────────────
describe('POST /api/agents/trigger — dedup + cooldown', () => {
  test('outside cooldown window — inserts sent row, returns 200 { success: true }', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc', member_id: 'member-xyz' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.skipped).toBeUndefined();

    // Insert called with status sent
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' })
    );
  });

  test('within cooldown window — inserts skipped row, returns 200 { success: true, skipped: true, reason: cooldown }', async () => {
    mockDedupLimit.mockResolvedValue({ data: [{ id: 'existing-log' }], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc', member_id: 'member-xyz' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('cooldown');

    // Only a skipped insert — no sent insert
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', error_message: 'Cooldown window active' })
    );
    // The sent insert should NOT have been called
    const calls = mockSupabaseInsert.mock.calls;
    const sentCalls = calls.filter((c) => c[0]?.status === 'sent');
    expect(sentCalls).toHaveLength(0);
  });

  test('with member_id — dedup query scoped with .eq(member_id)', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'retention-agent',
      payload: { event: 'member-at-risk', gym_id: 'gym-abc', member_id: 'member-a' },
    });
    await POST(req);

    // Verify the dedup select was called — chain starts with .select('id')
    expect(mockDedupSelect).toHaveBeenCalledWith('id');
    // member_id scoping via eq chain — the mock chain verifies the chain was called
    expect(mockDedupEq4).toHaveBeenCalledWith('member_id', 'member-a');
  });

  test('without member_id — dedup query uses .is(member_id, null)', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc' },
    });
    await POST(req);

    // Without member_id the .is('member_id', null) branch is taken
    expect(mockDedupIs).toHaveBeenCalledWith('member_id', null);
  });

  test('dedup_key present — dedup query filters by payload->>dedup_key', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc', dedup_key: 'session-123' },
    });
    await POST(req);

    // dedup_key filter applied
    expect(mockDedupEq5).toHaveBeenCalledWith('payload->>dedup_key', 'session-123');
  });

  test('is_agent_initiated: true and dedup_key in payload passes validation and appears in inserted log', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: {
        event: 'level-up',
        gym_id: 'gym-abc',
        is_agent_initiated: true,
        dedup_key: 'unique-key-xyz',
      },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Both fields must appear in the inserted payload
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          is_agent_initiated: true,
          dedup_key: 'unique-key-xyz',
        }),
      })
    );
  });

  test('tier gating preserved: starter gym + level-up → 403 + skipped log', async () => {
    mockCheckAgentAccess.mockResolvedValue({
      hasAccess: false,
      reason: 'Feature not available on starter tier',
      upgradeMessage: 'Upgrade to Growth.',
    });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-starter' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });

  test('platform bypass: starter gym + new-gym-onboarded → checkAgentAccess NOT called, sent row, 200', async () => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });

    const req = makeRequest({
      agent_name: 'growth-agent',
      payload: { event: 'new-gym-onboarded', gym_id: 'gym-starter-new' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // checkAgentAccess must NOT be called for platform events
    expect(mockCheckAgentAccess).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' })
    );
  });
});

// ─── Forwarding tests (AGENT-01) ──────────────────────────
describe('POST /api/agents/trigger — UPTIMIZE forwarding', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockDedupLimit.mockResolvedValue({ data: [], error: null });
    mockSupabaseInsertSingle.mockResolvedValue({ data: { id: 'log-row-42' }, error: null });

    mockFetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = mockFetch;
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).fetch;
  });

  test('UPTIMIZE_WEBHOOK_URL set + successful trigger → fetch called once with correct args', async () => {
    process.env.UPTIMIZE_WEBHOOK_URL = 'https://uptimize.example.com/webhook';
    process.env.UPTIMIZE_API_KEY = 'uptimize-secret';

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Flush microtasks so fire-and-forget completes
    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://uptimize.example.com/webhook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-uptimize-key']).toBe('uptimize-secret');
    expect(opts.signal).toBeDefined(); // AbortSignal

    const sentBody = JSON.parse(opts.body);
    expect(sentBody.agent_name).toBe('engagement-agent');
    expect(sentBody.log_id).toBe('log-row-42');
    expect(sentBody.payload).toBeDefined();
  });

  test('UPTIMIZE_WEBHOOK_URL unset → fetch never called; sent row still inserted; 200 returned', async () => {
    delete process.env.UPTIMIZE_WEBHOOK_URL;

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' })
    );
  });

  test('fetch rejects → smartgym_agent_logs .update called with status failed; route returned 200', async () => {
    process.env.UPTIMIZE_WEBHOOK_URL = 'https://uptimize.example.com/webhook';
    process.env.UPTIMIZE_API_KEY = 'uptimize-secret';

    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc' },
    });
    const res = await POST(req);
    const body = await res.json();

    // Route must return 200 (fire-and-forget never blocks the response)
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Flush microtasks so the .catch() runs
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // update called to record failure
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error_message: expect.any(String) })
    );
    expect(mockSupabaseUpdateEq).toHaveBeenCalledWith('id', 'log-row-42');
  });

  test('cooldown-skipped triggers never call fetch', async () => {
    process.env.UPTIMIZE_WEBHOOK_URL = 'https://uptimize.example.com/webhook';
    process.env.UPTIMIZE_API_KEY = 'uptimize-secret';

    // Dedup returns a hit — within cooldown
    mockDedupLimit.mockResolvedValue({ data: [{ id: 'existing' }], error: null });

    const req = makeRequest({
      agent_name: 'engagement-agent',
      payload: { event: 'level-up', gym_id: 'gym-abc' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.skipped).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
