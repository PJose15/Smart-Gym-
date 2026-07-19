/**
 * @jest-environment node
 *
 * Tests for POST /api/owner/members/import
 *
 * Mocks:
 *  - @/lib/auth/verifyStaff
 *  - @/lib/rateLimit
 *  - @/lib/import/parseMembersCsv
 *  - admin client rpc (via verifyStaff return value)
 */

import { NextRequest } from 'next/server';

// ─── Mock verifyStaff ─────────────────────────────────────
const mockVerifyStaff = jest.fn();
jest.mock('@/lib/auth/verifyStaff', () => ({
  verifyStaff: (role: string) => mockVerifyStaff(role),
}));

// ─── Mock rateLimit ───────────────────────────────────────
const mockCheckRateLimit = jest.fn().mockReturnValue(null);
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (key: string, max: number, ms: number) => mockCheckRateLimit(key, max, ms),
}));

// ─── Mock parseMembersCsv ─────────────────────────────────
const mockParseMembersCsv = jest.fn();
jest.mock('@/lib/import/parseMembersCsv', () => ({
  parseMembersCsv: (text: string) => mockParseMembersCsv(text),
}));

// ─── Admin client mock (rpc) ──────────────────────────────
const mockRpc = jest.fn();

function buildAdminMock() {
  return {
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  };
}

function makeOwnerResult(overrides = {}) {
  return {
    user_id: 'user-owner-123',
    gym_id: 'gym-abc',
    role: 'owner',
    permissions: {},
    admin: buildAdminMock(),
    ...overrides,
  };
}

function makeRequest(formData: FormData) {
  return new NextRequest('http://localhost/api/owner/members/import', {
    method: 'POST',
    body: formData,
  });
}

function makeFormData(mode: string, csvContent = 'email,name\nbob@example.com,Bob') {
  const file = new File([csvContent], 'members.csv', { type: 'text/csv' });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('mode', mode);
  return fd;
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../import/route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(null);
});

// T6: validate phase returns { valid, invalid, total } with no DB writes
test('T6: validate mode returns preview without calling rpc', async () => {
  mockVerifyStaff.mockResolvedValue(makeOwnerResult());
  mockParseMembersCsv.mockReturnValue({
    valid: [{ display_name: 'Bob Smith', first_name: 'Bob', email: 'bob@example.com', phone: '+15551234567', warnings: [] }],
    invalid: [],
    total: 1,
  });

  const req = makeRequest(makeFormData('validate'));
  const res = await POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('valid');
  expect(body).toHaveProperty('invalid');
  expect(body).toHaveProperty('total', 1);
  // No DB writes — rpc never called
  expect(mockRpc).not.toHaveBeenCalled();
});

// T7: >500 rows → 400 'Max 500 rows per import'
test('T7: more than 500 rows returns 400', async () => {
  mockVerifyStaff.mockResolvedValue(makeOwnerResult());
  const manyRows = Array(501).fill({
    display_name: 'Bob', first_name: 'Bob', email: 'bob@example.com', phone: null, warnings: [],
  });
  mockParseMembersCsv.mockReturnValue({
    valid: manyRows,
    invalid: [],
    total: 501,
  });

  const req = makeRequest(makeFormData('validate'));
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/500/);
});

// T8: import phase calls bulk_import_members with only valid rows
test('T8: import mode calls bulk_import_members with valid rows only', async () => {
  mockVerifyStaff.mockResolvedValue(makeOwnerResult());
  mockParseMembersCsv.mockReturnValue({
    valid: [
      { display_name: 'Bob Smith', first_name: 'Bob', email: 'bob@example.com', phone: '+15551234567', warnings: [] },
    ],
    invalid: [
      { row: 2, errors: ['invalid email'], raw: { email: 'bad@', name: 'Alice' } },
    ],
    total: 2,
  });
  mockRpc.mockResolvedValue({
    data: { imported: 1, skipped: [] },
    error: null,
  });

  const req = makeRequest(makeFormData('import'));
  const res = await POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('imported', 1);
  expect(body).toHaveProperty('skipped');
  expect(body).toHaveProperty('invalid_count', 1);

  // Only valid rows sent to RPC
  expect(mockRpc).toHaveBeenCalledWith('bulk_import_members', {
    p_gym_id: 'gym-abc',
    p_members: expect.arrayContaining([
      expect.objectContaining({ email: 'bob@example.com' }),
    ]),
  });
  // Only 1 valid row sent
  const callArgs = mockRpc.mock.calls[0][1] as { p_members: unknown[] };
  expect(callArgs.p_members).toHaveLength(1);
});

// T9: non-owner → 401/403 passthrough
test('T9: non-owner request returns 403', async () => {
  const { NextResponse } = await import('next/server');
  const authError = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  mockVerifyStaff.mockResolvedValue(authError);

  const req = makeRequest(makeFormData('validate'));
  const res = await POST(req);
  expect(res.status).toBe(403);
});
