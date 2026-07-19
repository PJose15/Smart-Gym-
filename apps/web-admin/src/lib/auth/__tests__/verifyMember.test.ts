/**
 * @jest-environment node
 *
 * Tests for verifyMember — cookie path + Bearer JWT path
 *
 * Mocks:
 *  - @/lib/supabase/server (createServerSupabaseClient) — cookie-based client
 *  - @supabase/supabase-js (createClient) — admin client
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Mock createServerSupabaseClient (cookie path) ───────
const mockGetSession = jest.fn();
const mockCookieClient = {
  auth: { getSession: mockGetSession },
};
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue(mockCookieClient),
}));

// ─── Mock createClient (admin/service-role client) ───────
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
const mockEq1 = jest.fn();
const mockEq2 = jest.fn();

function buildAdminMock() {
  return {
    auth: { getUser: mockGetUser },
    from: jest.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq1.mockReturnValue({
          eq: mockEq2.mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    })),
  };
}

const mockAdminInstance = buildAdminMock();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockAdminInstance),
}));

// Import AFTER mocks are set up
let verifyMember: (requestedMemberId: string, request?: Request) => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../verifyMember');
  verifyMember = mod.verifyMember;
});

const MEMBER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const VALID_TOKEN = 'valid.jwt.token';

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;
  return new NextRequest('http://localhost/api/member/test', { method: 'POST', headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no cookie session
  mockGetSession.mockResolvedValue({ data: { session: null } });
  // Default: no Bearer user
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  // Default: member found
  mockMaybeSingle.mockResolvedValue({ data: { id: MEMBER_ID }, error: null });
});

// ─── T1: Cookie path (unchanged behavior) ────────────────
test('T1: valid cookie session returns { member_id, admin }', async () => {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: USER_ID } } },
  });
  mockMaybeSingle.mockResolvedValue({ data: { id: MEMBER_ID }, error: null });

  const result = await verifyMember(MEMBER_ID) as { member_id: string; admin: unknown };
  expect(result).not.toBeInstanceOf(NextResponse);
  expect(result.member_id).toBe(MEMBER_ID);
  expect(result.admin).toBeDefined();
});

// ─── T2: Bearer happy path ────────────────────────────────
test('T2: Bearer JWT resolves user and returns { member_id, admin }', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mockMaybeSingle.mockResolvedValue({ data: { id: MEMBER_ID }, error: null });

  const req = makeRequest(`Bearer ${VALID_TOKEN}`);
  const result = await verifyMember(MEMBER_ID, req) as { member_id: string; admin: unknown };
  expect(result).not.toBeInstanceOf(NextResponse);
  expect(result.member_id).toBe(MEMBER_ID);
  expect(result.admin).toBeDefined();
  expect(mockGetUser).toHaveBeenCalledWith(VALID_TOKEN);
});

// ─── T3: Invalid Bearer (getUser error, no cookie session) ─
test('T3: invalid Bearer token with no cookie session returns 401', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const req = makeRequest(`Bearer ${VALID_TOKEN}`);
  const result = await verifyMember(MEMBER_ID, req);
  expect(result).toBeInstanceOf(NextResponse);
  const res = result as NextResponse;
  expect(res.status).toBe(401);
});

// ─── T4: Bearer user does not own member ─────────────────
test('T4: Bearer user found but member ownership fails returns 403', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  // No matching member row for this user+memberId combo
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  const req = makeRequest(`Bearer ${VALID_TOKEN}`);
  const result = await verifyMember(MEMBER_ID, req);
  expect(result).toBeInstanceOf(NextResponse);
  const res = result as NextResponse;
  expect(res.status).toBe(403);
});

// ─── T5: No auth at all ──────────────────────────────────
test('T5: no header and no cookie session returns 401', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const req = makeRequest(); // no Authorization header
  const result = await verifyMember(MEMBER_ID, req);
  expect(result).toBeInstanceOf(NextResponse);
  const res = result as NextResponse;
  expect(res.status).toBe(401);
});
