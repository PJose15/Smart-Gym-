/**
 * @jest-environment node
 *
 * Tests for POST /api/onboard/register
 *
 * Mocks:
 *  - @/lib/supabase/server (createServerSupabaseClient)
 *  - @supabase/supabase-js (createClient — for admin client)
 *  - @/lib/rateLimit (checkRateLimit)
 *  - @nexera/utils (generateSlug)
 */

import { NextRequest } from 'next/server';

// ─── Mock rateLimit ───────────────────────────────────────
const mockCheckRateLimit = jest.fn().mockReturnValue(null);
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ─── Mock @nexera/utils ───────────────────────────────────
jest.mock('@nexera/utils', () => ({
  generateSlug: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
  generateQrSlug: jest.fn(),
}));

// ─── Mock supabase server (anon client for signUp) ────────
const mockSignUp = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  })),
}));

// ─── Mock admin client (service-role, for users insert + RPC + deleteUser) ──
const mockUsersInsert = jest.fn();
const mockRpc = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'users') {
        return { insert: mockUsersInsert };
      }
      return {};
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  })),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/onboard/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  owner_name: 'Alice Owner',
  email: 'alice@example.com',
  password: 'securepass123',
  gym_name: 'Iron Society',
  city: 'Miami',
  gym_type: 'independent',
};

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../register/route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(null);
  // Default: happy-path signUp returns a real user with identities
  mockSignUp.mockResolvedValue({
    data: {
      user: {
        id: 'user-abc123',
        email: 'alice@example.com',
        email_confirmed_at: null,
        identities: [{ id: 'identity-1', provider: 'email' }],
      },
    },
    error: null,
  });
  mockUsersInsert.mockResolvedValue({ error: null });
  mockRpc.mockResolvedValue({ data: 'gym-uuid-789', error: null });
  mockDeleteUser.mockResolvedValue({ data: {}, error: null });
});

// Test 1: invalid body → 400 with fieldErrors
test('T1: invalid body (bad email, short password) returns 400 with fieldErrors', async () => {
  const req = makeRequest({ owner_name: 'A', email: 'not-an-email', password: 'short', gym_name: 'X' });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty('fieldErrors');
});

// Test 2: happy path → signUp called, users insert, RPC, returns 200 { gym_id, email }
test('T2: valid body creates user, inserts users row, calls RPC, returns 200 with gym_id + email', async () => {
  const req = makeRequest(validBody);
  const res = await POST(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('gym_id', 'gym-uuid-789');
  expect(body).toHaveProperty('email', 'alice@example.com');

  // signUp called with emailRedirectTo ending /subscribe
  expect(mockSignUp).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'alice@example.com',
      password: 'securepass123',
      options: expect.objectContaining({
        emailRedirectTo: expect.stringContaining('/subscribe'),
        data: expect.objectContaining({ display_name: 'Alice Owner' }),
      }),
    })
  );

  // users insert with gym_owner role
  expect(mockUsersInsert).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'user-abc123',
      email: 'alice@example.com',
      display_name: 'Alice Owner',
      platform_role: 'gym_owner',
    })
  );

  // RPC with p_gym_slug derived from gym_name
  expect(mockRpc).toHaveBeenCalledWith(
    'complete_gym_onboarding',
    expect.objectContaining({
      p_user_id: 'user-abc123',
      p_gym_name: 'Iron Society',
      p_gym_slug: 'iron-society',
    })
  );
});

// Test 3: duplicate email (signUp returns user with identities: []) → 409, no insert, no RPC
test('T3: duplicate email returns 409, does not insert users row or call RPC', async () => {
  mockSignUp.mockResolvedValue({
    data: {
      user: {
        id: 'fake-user-id',
        email: 'alice@example.com',
        identities: [],
      },
    },
    error: null,
  });

  const req = makeRequest(validBody);
  const res = await POST(req);
  expect(res.status).toBe(409);
  expect(mockUsersInsert).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

// Test 4: RPC failure → deleteUser called with new user id, returns 500
test('T4: RPC failure triggers deleteUser rollback and returns 500', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

  const req = makeRequest(validBody);
  const res = await POST(req);
  expect(res.status).toBe(500);
  expect(mockDeleteUser).toHaveBeenCalledWith('user-abc123');
});

// Test 5: users-insert failure → deleteUser called, returns 500
test('T5: users insert failure triggers deleteUser rollback and returns 500', async () => {
  mockUsersInsert.mockResolvedValue({ error: { message: 'insert failed' } });

  const req = makeRequest(validBody);
  const res = await POST(req);
  expect(res.status).toBe(500);
  expect(mockDeleteUser).toHaveBeenCalledWith('user-abc123');
  expect(mockRpc).not.toHaveBeenCalled();
});
