/**
 * @jest-environment node
 *
 * Tests for GET /api/onboard/status
 *
 * Mocks:
 *  - @/lib/supabase/server (createServerSupabaseClient)
 *  - @supabase/supabase-js (createClient — for admin client)
 */

// ─── Mock @/lib/supabase/server (anon/cookie client) ─────
const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  })),
}));

// ─── Mock admin client (service-role) ────────────────────
// jest.mock factory must not reference out-of-scope vars.
// We use a module-level mockCreateClient so that per-test
// calls to (createClient as jest.Mock).mockReturnValue(...) work.
const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// ─── Helper: build an admin mock with specified data ─────
function buildAdminMock(opts: {
  membership?: { gym_id: string; role: string; status: string } | null;
  gym?: { name: string; subscription_tier: string } | null;
  billing?: {
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
  } | null;
}) {
  const { membership = null, gym = null, billing = null } = opts;

  return {
    from: jest.fn((table: string) => {
      if (table === 'gym_memberships') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: membership,
            error: membership ? null : { code: 'PGRST116', message: 'no rows' },
          }),
        };
      }
      if (table === 'gyms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: gym, error: null }),
            }),
          }),
        };
      }
      if (table === 'gym_billing') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: billing, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  };
}

let GET: () => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../status/route');
  GET = mod.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default admin mock (empty state)
  mockCreateClient.mockReturnValue(buildAdminMock({}));
});

// Test 6a: no authenticated user → 401
test('T6a: no session returns 401', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

  const res = await GET();
  expect(res.status).toBe(401);
});

// Test 6b: with session + owner membership → 200 with full status object
test('T6b: session with owner membership returns 200 with gym_id, gym_name, tier, email_confirmed, billing', async () => {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: 'user-123',
        email: 'alice@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    },
    error: null,
  });

  mockCreateClient.mockReturnValue(
    buildAdminMock({
      membership: { gym_id: 'gym-456', role: 'owner', status: 'active' },
      gym: { name: 'Iron Society', subscription_tier: 'starter' },
      billing: {
        stripe_customer_id: 'cus_abc',
        stripe_subscription_id: null,
        subscription_status: 'trialing',
      },
    })
  );

  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({
    gym_id: 'gym-456',
    gym_name: 'Iron Society',
    tier: 'starter',
    email_confirmed: true,
    billing: {
      has_customer: true,
      has_subscription: false,
      subscription_status: 'trialing',
    },
  });
});
