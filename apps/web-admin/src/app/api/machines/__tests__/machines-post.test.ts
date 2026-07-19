/**
 * @jest-environment node
 *
 * Tests for POST /api/machines
 *
 * Mocks:
 *  - @/lib/auth/verifyStaff
 *  - @/lib/rateLimit
 *  - @nexera/ai-assist (generateMachineMistakes)
 *  - @nexera/utils (generateQrSlug)
 *  - Supabase admin client (via verifyStaff return value)
 */

import { NextRequest } from 'next/server';

// ─── Mock verifyStaff ─────────────────────────────────────
const mockVerifyStaff = jest.fn();
jest.mock('@/lib/auth/verifyStaff', () => ({
  verifyStaff: (...args: unknown[]) => mockVerifyStaff(...args),
}));

// ─── Mock rateLimit ───────────────────────────────────────
const mockCheckRateLimit = jest.fn().mockReturnValue(null);
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ─── Mock generateMachineMistakes ─────────────────────────
const mockGenerateMachineMistakes = jest.fn().mockResolvedValue(['keep back straight']);
jest.mock('@nexera/ai-assist', () => ({
  generateMachineMistakes: (...args: unknown[]) => mockGenerateMachineMistakes(...args),
}));

// ─── Mock generateQrSlug ──────────────────────────────────
jest.mock('@nexera/utils', () => ({
  generateQrSlug: (gymSlug: string, name: string) =>
    `${gymSlug}-${name.toLowerCase().replace(/\s+/g, '-')}`,
}));

// ─── Supabase admin client mock ───────────────────────────
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockInsertSelect = jest.fn();
const mockInsertSingle = jest.fn();

function buildAdminMock() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'gyms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === 'machines') {
        return {
          insert: mockInsert.mockReturnValue({
            select: mockInsertSelect.mockReturnValue({
              single: mockInsertSingle,
            }),
          }),
        };
      }
      return {};
    }),
  };
}

function makeStaffResult(overrides = {}) {
  return {
    user_id: 'user-123',
    gym_id: 'gym-456',
    role: 'owner',
    permissions: {},
    admin: buildAdminMock(),
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/machines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  mockCheckRateLimit.mockReturnValue(null);
  mockGenerateMachineMistakes.mockResolvedValue(['keep back straight']);
  mockSingle.mockResolvedValue({ data: { slug: 'iron-society' }, error: null });
  mockInsertSingle.mockResolvedValue({
    data: { id: 'machine-789', name: 'Lat Pulldown', qr_slug: 'iron-society-lat-pulldown' },
    error: null,
  });
});

// T1: unauthenticated → 401
test('T1: unauthenticated request returns 401', async () => {
  const { NextResponse } = await import('next/server');
  const authError = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  mockVerifyStaff.mockResolvedValue(authError);

  const req = makeRequest({ name: 'Lat Pulldown', target_muscles: ['lats'] });
  const res = await POST(req);
  expect(res.status).toBe(401);
});

// T2: invalid body (empty name) → 400 with fieldErrors
test('T2: empty name returns 400 with fieldErrors', async () => {
  mockVerifyStaff.mockResolvedValue(makeStaffResult());

  const req = makeRequest({ name: '', target_muscles: ['lats'] });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty('fieldErrors');
  expect(body.fieldErrors).toHaveProperty('name');
});

// T3: valid body → 201 with id + name + qr_slug, gym_id from verifyStaff
test('T3: valid body inserts machine and returns 201', async () => {
  mockVerifyStaff.mockResolvedValue(makeStaffResult());

  const req = makeRequest({
    name: 'Lat Pulldown',
    target_muscles: ['lats', 'biceps'],
    equipment_type: 'machine',
    movement_pattern: 'pull',
    difficulty: 'intermediate',
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body).toHaveProperty('id');
  expect(body).toHaveProperty('name', 'Lat Pulldown');
  expect(body).toHaveProperty('qr_slug');
  // gym_id must come from verifyStaff, not body
  expect(mockInsert).toHaveBeenCalledWith(
    expect.objectContaining({ gym_id: 'gym-456' })
  );
});

// T4: qr_slug 23505 collision → retry once with 4-char suffix
test('T4: 23505 unique violation retries once with suffix', async () => {
  mockVerifyStaff.mockResolvedValue(makeStaffResult());

  mockInsertSingle
    .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } })
    .mockResolvedValueOnce({
      data: { id: 'machine-999', name: 'Lat Pulldown', qr_slug: 'iron-society-lat-pulldown-ab12' },
      error: null,
    });

  const req = makeRequest({ name: 'Lat Pulldown', target_muscles: ['lats'] });
  const res = await POST(req);
  expect(res.status).toBe(201);
  // insert called twice
  expect(mockInsert).toHaveBeenCalledTimes(2);
  // second call qr_slug has a 4-char suffix
  const secondCall = mockInsert.mock.calls[1][0];
  expect(secondCall.qr_slug).toMatch(/-[a-z0-9]{4}$/);
});

// T5: name > 80 chars → 400
test('T5: name longer than 80 chars returns 400', async () => {
  mockVerifyStaff.mockResolvedValue(makeStaffResult());

  const req = makeRequest({ name: 'A'.repeat(81), target_muscles: ['lats'] });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty('fieldErrors');
  expect(body.fieldErrors).toHaveProperty('name');
});
