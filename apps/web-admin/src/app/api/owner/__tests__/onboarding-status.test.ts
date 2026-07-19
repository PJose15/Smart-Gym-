/**
 * Tests for GET /api/owner/onboarding-status
 *
 * Tests 1-5 correspond to the behaviors listed in the PLAN.md task spec.
 * The route is tested via the exported pure helper `computeDaysRemaining`
 * and through a lightweight harness that calls GET() with mocked dependencies.
 */

// ── Mock next/server before any imports ──────────────────────────────────────
// jsdom does not define Request/Response globals that next/server requires.
// The factory must be self-contained (jest.mock is hoisted; no outer refs allowed).
jest.mock('next/server', () => {
  class _MockNextResponse {
    status: number;
    _body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this._body = body;
      this.status = init?.status ?? 200;
    }
    async json() { return this._body; }
    static json(body: unknown, init?: { status?: number }) {
      return new _MockNextResponse(body, init);
    }
  }
  return {
    NextResponse: _MockNextResponse,
    NextRequest: jest.fn(),
  };
});

// ── Mock Supabase server ──────────────────────────────────────────────────────
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

// ── Mock verifyStaff ──────────────────────────────────────────────────────────
const mockVerifyStaff = jest.fn();
jest.mock('@/lib/auth/verifyStaff', () => ({
  verifyStaff: (...args: unknown[]) => mockVerifyStaff(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { computeDaysRemaining } from '../onboarding-status/route';
import { NextResponse } from 'next/server';

// ── Helper: build admin mock with specified counts ────────────────────────────
function buildAdminMock(opts: {
  machinesCount?: number;
  membersCount?: number;
  scansCount?: number;
  billing?: { subscription_status: string; trial_ends_at: string | null } | null;
}) {
  const { machinesCount = 0, membersCount = 0, scansCount = 0, billing = null } = opts;

  const countsByTable: Record<string, number> = {
    machines: machinesCount,
    members: membersCount,
    machine_scan_events: scansCount,
  };

  return {
    from: jest.fn((table: string) => {
      if (table === 'gym_billing') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: billing, error: null }),
        };
      }
      const count = countsByTable[table] ?? 0;
      const chain: Record<string, jest.Mock> & { then?: Function } = {
        select: jest.fn(),
        eq: jest.fn(),
      };
      chain.then = (resolve: (v: { count: number; error: null }) => void) =>
        Promise.resolve({ count, error: null }).then(resolve);
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      return chain;
    }),
  };
}

// ── computeDaysRemaining unit tests ──────────────────────────────────────────

describe('computeDaysRemaining', () => {
  it('returns null when trialEndsAt is null', () => {
    expect(computeDaysRemaining(null)).toBeNull();
  });

  it('returns ceil of fractional days: 10.5 days out → 11', () => {
    const now = 1_700_000_000_000;
    const trialEndsAt = new Date(now + 10.5 * 86_400_000).toISOString();
    expect(computeDaysRemaining(trialEndsAt, now)).toBe(11);
  });

  it('clamps to 0 when trial_ends_at is in the past', () => {
    const now = 1_700_000_000_000;
    const trialEndsAt = new Date(now - 3 * 86_400_000).toISOString();
    expect(computeDaysRemaining(trialEndsAt, now)).toBe(0);
  });

  it('clamps to 0 for exactly expired trial (same millisecond)', () => {
    const now = 1_700_000_000_000;
    const trialEndsAt = new Date(now).toISOString();
    expect(computeDaysRemaining(trialEndsAt, now)).toBe(0);
  });
});

// ── Route integration tests ───────────────────────────────────────────────────

describe('GET /api/owner/onboarding-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: non-owner → verifyStaff's 401/403 passthrough
  it('T1: returns 403 for non-owner', async () => {
    mockVerifyStaff.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const { GET } = await import('../onboarding-status/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  // Test 2: gym with 1 machine, 0 members, 0 scans
  it('T2: has_machine=true, has_members=false, has_shared_qr=false', async () => {
    mockVerifyStaff.mockResolvedValue({
      user_id: 'u1',
      gym_id: 'gym1',
      role: 'owner',
      permissions: {},
      admin: buildAdminMock({ machinesCount: 1, membersCount: 0, scansCount: 0 }),
    });

    const { GET } = await import('../onboarding-status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checklist.has_machine).toBe(true);
    expect(body.checklist.has_members).toBe(false);
    expect(body.checklist.has_shared_qr).toBe(false);
  });

  // Test 3: trialing gym, trial_ends_at 10.5 days out → days_remaining = 11 (ceil)
  it('T3: is_trialing=true, days_remaining=11 for 10.5 day remaining trial', async () => {
    const now = Date.now();
    const trialEndsAt = new Date(now + 10.5 * 86_400_000).toISOString();
    mockVerifyStaff.mockResolvedValue({
      user_id: 'u1',
      gym_id: 'gym1',
      role: 'owner',
      permissions: {},
      admin: buildAdminMock({
        billing: { subscription_status: 'trialing', trial_ends_at: trialEndsAt },
      }),
    });

    const { GET } = await import('../onboarding-status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trial.is_trialing).toBe(true);
    expect(body.trial.days_remaining).toBe(11);
  });

  // Test 4: trial_ends_at in the past → days_remaining === 0 (clamped)
  it('T4: days_remaining=0 when trial already expired', async () => {
    const trialEndsAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockVerifyStaff.mockResolvedValue({
      user_id: 'u1',
      gym_id: 'gym1',
      role: 'owner',
      permissions: {},
      admin: buildAdminMock({
        billing: { subscription_status: 'trialing', trial_ends_at: trialEndsAt },
      }),
    });

    const { GET } = await import('../onboarding-status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trial.is_trialing).toBe(true);
    expect(body.trial.days_remaining).toBe(0);
  });

  // Test 5: subscription_status 'active' → is_trialing=false, days_remaining null
  it('T5: is_trialing=false, days_remaining=null for active subscription', async () => {
    mockVerifyStaff.mockResolvedValue({
      user_id: 'u1',
      gym_id: 'gym1',
      role: 'owner',
      permissions: {},
      admin: buildAdminMock({
        billing: { subscription_status: 'active', trial_ends_at: null },
      }),
    });

    const { GET } = await import('../onboarding-status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trial.is_trialing).toBe(false);
    expect(body.trial.days_remaining).toBeNull();
  });
});
