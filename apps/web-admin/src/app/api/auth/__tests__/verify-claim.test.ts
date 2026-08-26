/**
 * @jest-environment node
 *
 * Tests for the 'invited' member claim path in findOrCreateMember
 * (api/auth/verify/route.ts)
 *
 * Verifies the status transition logic by capturing the update() call args.
 * The mock returns whatever the implementation sets in the update payload,
 * so if the implementation sends onboarding_status: 'invited' (wrong),
 * the test fails.
 */

import { NextRequest } from 'next/server';

// Enable dev OTP bypass so the route doesn't call real Supabase Auth.
// NODE_ENV is 'test' in Jest by default. We only set the OTP flag + DB creds.
beforeAll(() => {
  process.env.NEXT_PUBLIC_DEV_OTP = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_DEV_OTP;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ─── Mock rateLimit ───────────────────────────────────────
const mockCheckRateLimit = jest.fn().mockReturnValue(null);
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (key: string, max: number, ms: number) => mockCheckRateLimit(key, max, ms),
}));

// ─── Admin client mock ────────────────────────────────────
const mockListUsers = jest.fn();
const mockFrom = jest.fn();
// Captured update payload — we verify the implementation sends correct status
let capturedUpdatePayload: Record<string, unknown> | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        listUsers: () => mockListUsers(),
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: DEV_USER_ID } },
          error: null,
        }),
        updateUserById: jest.fn().mockResolvedValue({
          data: { user: { id: DEV_USER_ID } },
          error: null,
        }),
      },
    },
    from: (table: string) => mockFrom(table),
  })),
}));

// Cookie-session client (Stage 2): verify now establishes a session on this
// client. In dev the route signs in with the deterministic dev password.
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: { id: DEV_USER_ID }, session: {} },
        error: null,
      }),
      verifyOtp: jest.fn().mockResolvedValue({
        data: { user: { id: DEV_USER_ID }, session: {} },
        error: null,
      }),
    },
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const GYM_ID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
const PHONE = '+15551234567';
const DEV_USER_ID = 'dev-user-abc';

/**
 * Build a from() mock that:
 * 1. Returns the given member row on the .select()...maybeSingle() path
 * 2. Captures the update payload and reflects onboarding_status from the
 *    update call back in the returned row (so the test sees what was sent)
 */
function buildFromMock(memberRow: {
  id: string;
  user_id: string | null;
  onboarding_status: string;
  display_name: string;
  first_name: string | null;
  phone: string;
  primary_goal: string | null;
  experience_level: string | null;
  gym_id: string;
}) {
  return (table: string) => {
    if (table === 'members') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
          // Capture what the implementation sends
          capturedUpdatePayload = payload;
          return {
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    ...memberRow,
                    user_id: DEV_USER_ID,
                    // Reflect back what the implementation set
                    onboarding_status: payload['onboarding_status'] as string,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: memberRow, error: null }),
      };
    }
    if (table === 'member_settings') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  };
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../verify/route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  capturedUpdatePayload = null;
  mockCheckRateLimit.mockReturnValue(null);

  // Dev mode OTP bypass: listUsers returns existing dev user
  mockListUsers.mockResolvedValue({
    data: { users: [{ id: DEV_USER_ID, phone: PHONE }] },
    error: null,
  });
});

// T1: invited member with matching phone → user_id set + status becomes 'in_progress'
test('T1: invited member links on phone OTP and transitions to in_progress', async () => {
  const invitedMember = {
    id: 'member-invited-1',
    user_id: null,
    onboarding_status: 'invited',
    display_name: 'Alice Smith',
    first_name: 'Alice',
    phone: PHONE,
    primary_goal: null,
    experience_level: null,
    gym_id: GYM_ID,
  };

  mockFrom.mockImplementation(buildFromMock(invitedMember));

  const req = makeRequest({ phone: PHONE, code: '123456', gym_id: GYM_ID });
  const res = await POST(req);

  expect(res.status).toBe(200);
  const body = await res.json() as {
    success: boolean;
    member: { onboarding_status: string; user_id: string };
  };
  expect(body.success).toBe(true);
  // The reflected status should be in_progress (implementation must set this)
  expect(body.member.onboarding_status).toBe('in_progress');
  expect(body.member.user_id).toBe(DEV_USER_ID);
  // The update was called with in_progress (not 'invited')
  expect(capturedUpdatePayload?.['onboarding_status']).toBe('in_progress');
});

// T2: 'pending' → 'in_progress' still works (regression guard)
test('T2: pending member links on phone OTP and transitions to in_progress', async () => {
  const pendingMember = {
    id: 'member-pending-1',
    user_id: null,
    onboarding_status: 'pending',
    display_name: 'Bob Jones',
    first_name: 'Bob',
    phone: PHONE,
    primary_goal: null,
    experience_level: null,
    gym_id: GYM_ID,
  };

  mockFrom.mockImplementation(buildFromMock(pendingMember));

  const req = makeRequest({ phone: PHONE, code: '123456', gym_id: GYM_ID });
  const res = await POST(req);

  expect(res.status).toBe(200);
  const body = await res.json() as {
    success: boolean;
    member: { onboarding_status: string };
  };
  expect(body.success).toBe(true);
  expect(body.member.onboarding_status).toBe('in_progress');
  expect(capturedUpdatePayload?.['onboarding_status']).toBe('in_progress');
});

// T3: already-linked member (user_id set) → returned as-is, no update called
test('T3: already-linked member is returned without re-linking', async () => {
  const linkedMember = {
    id: 'member-linked-1',
    user_id: 'existing-user-999',
    onboarding_status: 'in_progress',
    display_name: 'Carol White',
    first_name: 'Carol',
    phone: PHONE,
    primary_goal: null,
    experience_level: null,
    gym_id: GYM_ID,
  };

  const mockUpdate = jest.fn();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'members') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: mockUpdate,
        maybeSingle: jest.fn().mockResolvedValue({ data: linkedMember, error: null }),
      };
    }
    if (table === 'member_settings') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const req = makeRequest({ phone: PHONE, code: '123456', gym_id: GYM_ID });
  const res = await POST(req);

  expect(res.status).toBe(200);
  const body = await res.json() as {
    success: boolean;
    member: { onboarding_status: string; user_id: string };
  };
  expect(body.success).toBe(true);
  // update should NOT have been called
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(body.member.user_id).toBe('existing-user-999');
});
