/**
 * @jest-environment node
 *
 * Tests: session-complete agent triggers (AGENT-03)
 * Covers: level-up, streak-broken (with edge cases), leaderboard-updated
 * All calls are fire-and-forget — route must still return 200 even when agent rejects.
 */

// ── Mocks declared before imports ─────────────────────────────────────────────
jest.mock('@/lib/billing/triggerAgent');
jest.mock('@/lib/auth/verifyMember');
jest.mock('@/lib/rateLimit');
jest.mock('@/lib/achievements');
jest.mock('@/lib/feedGenerator');
jest.mock('@/lib/challengeScoring');
jest.mock('@/lib/readiness/readinessCache');
jest.mock('@/lib/muscleMap/muscleMapCache');
jest.mock('@/lib/validation/uuid');

// ── Imports ───────────────────────────────────────────────────────────────────
import { NextRequest } from 'next/server';
import { POST } from '../route';

import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkAchievementsForMember } from '@/lib/achievements';
import { generateSessionFeedEvents } from '@/lib/feedGenerator';
import { updateChallengeScores } from '@/lib/challengeScoring';
import { invalidateAndRefreshReadiness } from '@/lib/readiness/readinessCache';
import { invalidateAndRefreshMuscleMap } from '@/lib/muscleMap/muscleMapCache';
import { validateUUIDs } from '@/lib/validation/uuid';

// ── Typed mock refs ───────────────────────────────────────────────────────────
const mockTrigger = triggerUptimizeAIAgent as jest.MockedFunction<typeof triggerUptimizeAIAgent>;
const mockVerifyMember = verifyMember as jest.MockedFunction<typeof verifyMember>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockAchievements = checkAchievementsForMember as jest.MockedFunction<typeof checkAchievementsForMember>;
const mockFeedEvents = generateSessionFeedEvents as jest.MockedFunction<typeof generateSessionFeedEvents>;
const mockChallengeScores = updateChallengeScores as jest.MockedFunction<typeof updateChallengeScores>;
const mockRefreshReadiness = invalidateAndRefreshReadiness as jest.MockedFunction<typeof invalidateAndRefreshReadiness>;
const mockRefreshMuscleMap = invalidateAndRefreshMuscleMap as jest.MockedFunction<typeof invalidateAndRefreshMuscleMap>;
const mockValidateUUIDs = validateUUIDs as jest.MockedFunction<typeof validateUUIDs>;

// ── Test constants (must be valid UUIDs for completeSchema.safeParse) ────────
const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
const GYM_ID = 'c3d4e5f6-a7b8-9012-cdef-012345678902';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Gap > 3 days between entry 0 and entry 1 → route computes streak = 1 */
function makeStreakResetDates(): string[] {
  return ['2024-01-15', '2024-01-05']; // 10-day gap
}

/** Consecutive days → streak grows to `count` */
function makeStreakContinuingDates(count: number): string[] {
  const base = new Date('2024-01-15');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getTime() - i * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
}

/** Build a chainable Supabase admin mock for this route's query pattern */
function buildAdmin(opts: { currentStreak: number; recentDates: string[] }) {
  // The route calls admin.from() in this order:
  //   1. workout_sessions SELECT (single) — fetch session
  //   2. workout_sessions UPDATE — mark completed
  //   3. Promise.all([
  //        members SELECT single,
  //        workout_sessions SELECT recent (streak),
  //        workout_sessions SELECT count,
  //      ])
  //   4. members UPDATE

  let wsCallNum = 0;

  const from = jest.fn((table: string) => {
    if (table === 'members') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                smartgym_score: 1000,
                best_streak: opts.currentStreak,
                current_streak: opts.currentStreak,
                display_name: 'Test Member',
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    }

    if (table === 'workout_sessions') {
      wsCallNum++;
      if (wsCallNum === 1) {
        // Initial session SELECT (eq.eq.single chain)
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: SESSION_ID,
                    gym_id: GYM_ID,
                    member_id: MEMBER_ID,
                    sets_count: 3,
                    total_volume_lbs: 300,
                    best_weight_lbs: 100,
                    is_personal_best: false,
                    session_date: '2024-01-15',
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: jest.fn(),
        };
      }
      if (wsCallNum === 2) {
        // UPDATE completed_at
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
          select: jest.fn(),
        };
      }
      if (wsCallNum === 3) {
        // Promise.all slot 1: recent sessions (streak calc)
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: opts.recentDates.map(d => ({ session_date: d })),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (wsCallNum === 4) {
        // Promise.all slot 2: session count (head: true) — resolve as object
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                count: 5,
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }
      // Fallback
      return { select: jest.fn(), update: jest.fn() };
    }

    return {
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    };
  });

  return { from } as unknown as Parameters<typeof verifyMember>[0] extends unknown
    ? { from: typeof from }
    : never;
}

function makeRequest(memberId = MEMBER_ID) {
  return new NextRequest(`http://localhost/api/sessions/${SESSION_ID}/complete`, {
    method: 'POST',
    body: JSON.stringify({ member_id: memberId }),
    headers: { 'Content-Type': 'application/json' },
  });
}

const makeParams = () => ({ params: Promise.resolve({ sessionId: SESSION_ID }) });

// ── Test suite ────────────────────────────────────────────────────────────────
describe('POST /api/sessions/[sessionId]/complete — agent triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: benign mocks
    mockRateLimit.mockReturnValue(null);
    mockValidateUUIDs.mockReturnValue(null);
    mockTrigger.mockResolvedValue({ success: true });
    mockFeedEvents.mockReturnValue(undefined as unknown as ReturnType<typeof generateSessionFeedEvents>);
    mockChallengeScores.mockReturnValue(undefined as unknown as ReturnType<typeof updateChallengeScores>);
    mockRefreshReadiness.mockResolvedValue(undefined);
    mockRefreshMuscleMap.mockResolvedValue(undefined);

    // Default achievements: no level-up
    mockAchievements.mockResolvedValue({ leveledUp: false, newLevel: null, newAchievements: [] });

    // Default admin: streak=3, continuing dates
    const admin = buildAdmin({ currentStreak: 3, recentDates: makeStreakContinuingDates(3) });
    mockVerifyMember.mockResolvedValue({ admin } as Awaited<ReturnType<typeof verifyMember>>);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // level-up
  // ──────────────────────────────────────────────────────────────────────────

  it('fires engagement-agent level-up when achievements.leveledUp is true', async () => {
    mockAchievements.mockResolvedValue({ leveledUp: true, newLevel: { level: 5 }, newAchievements: [] });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const calls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>);
    const levelUpCalls = calls.filter(c => c[1]?.event === 'level-up');
    expect(levelUpCalls).toHaveLength(1);
    const [agentName, payload] = levelUpCalls[0];
    expect(agentName).toBe('engagement-agent');
    expect(payload.event).toBe('level-up');
    expect(payload.gym_id).toBe(GYM_ID);
    expect(payload.member_id).toBe(MEMBER_ID);
    expect(payload.new_level).toBe(5);
    expect(payload.is_agent_initiated).toBe(false);
  });

  it('does NOT fire level-up when achievements.leveledUp is false', async () => {
    mockAchievements.mockResolvedValue({ leveledUp: false, newLevel: null, newAchievements: [] });

    await POST(makeRequest(), makeParams());

    const levelUpCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'level-up'
    );
    expect(levelUpCalls).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // streak-broken
  // ──────────────────────────────────────────────────────────────────────────

  it('fires engagement-agent streak-broken when previousStreak > 1 and new streak = 1', async () => {
    // member had streak of 5, dates show gap → resets to 1
    const admin = buildAdmin({ currentStreak: 5, recentDates: makeStreakResetDates() });
    mockVerifyMember.mockResolvedValue({ admin } as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const brokenCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'streak-broken'
    );
    expect(brokenCalls).toHaveLength(1);
    const [agentName, payload] = brokenCalls[0];
    expect(agentName).toBe('engagement-agent');
    expect(payload.event).toBe('streak-broken');
    expect(payload.gym_id).toBe(GYM_ID);
    expect(payload.member_id).toBe(MEMBER_ID);
    expect(payload.previous_streak).toBe(5);
    expect(payload.is_agent_initiated).toBe(false);
  });

  it('does NOT fire streak-broken for first-ever session (previousStreak = 0)', async () => {
    const admin = buildAdmin({ currentStreak: 0, recentDates: makeStreakContinuingDates(1) });
    mockVerifyMember.mockResolvedValue({ admin } as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const brokenCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'streak-broken'
    );
    expect(brokenCalls).toHaveLength(0);
  });

  it('does NOT fire streak-broken when streak is continuing (prevStreak=3, new=4)', async () => {
    const admin = buildAdmin({ currentStreak: 3, recentDates: makeStreakContinuingDates(4) });
    mockVerifyMember.mockResolvedValue({ admin } as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const brokenCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'streak-broken'
    );
    expect(brokenCalls).toHaveLength(0);
  });

  it('does NOT fire streak-broken when previousStreak = 1 (boundary: condition is > 1)', async () => {
    const admin = buildAdmin({ currentStreak: 1, recentDates: makeStreakResetDates() });
    mockVerifyMember.mockResolvedValue({ admin } as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const brokenCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'streak-broken'
    );
    expect(brokenCalls).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // leaderboard-updated
  // ──────────────────────────────────────────────────────────────────────────

  it('fires engagement-agent leaderboard-updated on every successful completion', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const lbCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'leaderboard-updated'
    );
    expect(lbCalls).toHaveLength(1);
    const [agentName, payload] = lbCalls[0];
    expect(agentName).toBe('engagement-agent');
    expect(payload.event).toBe('leaderboard-updated');
    expect(payload.gym_id).toBe(GYM_ID);
    expect(payload.member_id).toBe(MEMBER_ID);
    expect(payload.session_id).toBe(SESSION_ID);
    expect(payload.is_agent_initiated).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Response shape unchanged
  // ──────────────────────────────────────────────────────────────────────────

  it('returns the expected response shape regardless of agent calls', async () => {
    mockAchievements.mockResolvedValue({ leveledUp: true, newLevel: { level: 7 }, newAchievements: [] });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      summary: expect.objectContaining({
        session_id: SESSION_ID,
        points_awarded: 50,
        streak: expect.any(Number),
      }),
      new_achievements: expect.arrayContaining([]),
      leveled_up: true,
      new_level: { level: 7 },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Fire-and-forget: rejection must not fail the request
  // ──────────────────────────────────────────────────────────────────────────

  it('still returns 200 when triggerUptimizeAIAgent rejects', async () => {
    mockTrigger.mockRejectedValue(new Error('Agent service down'));
    mockAchievements.mockResolvedValue({ leveledUp: true, newLevel: { level: 3 }, newAchievements: [] });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
