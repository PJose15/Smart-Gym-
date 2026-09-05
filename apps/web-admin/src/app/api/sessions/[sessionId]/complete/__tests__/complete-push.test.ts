/**
 * @jest-environment node
 *
 * Tests: session-complete route push integration (06-05 NOTIF-02)
 * Verifies:
 *   - Completing a session that leveled up emits exactly ONE sendNotification call (level_up)
 *   - Plain session (no PR/badge/level/milestone) emits ZERO sendNotification calls
 *   - Push dispatch failure never fails the route (mock rejects → still 200)
 */

// ── Mocks declared before imports ─────────────────────────────────────────────
jest.mock('@/lib/notifications/dispatcher', () => ({
  sendNotification: jest.fn().mockResolvedValue('sent'),
}));
jest.mock('@/lib/billing/triggerAgent');
jest.mock('@/lib/auth/verifyMember');
jest.mock('@/lib/rateLimit');
jest.mock('@/lib/achievements');
jest.mock('@/lib/feedGenerator');
jest.mock('@/lib/challengeScoring');
jest.mock('@/lib/readiness/readinessCache');
jest.mock('@/lib/muscleMap/muscleMapCache');
jest.mock('@/lib/validation/uuid', () => {
  const { z } = jest.requireActual('zod');
  return {
    validateUUIDs: jest.fn().mockReturnValue(null),
    uuidString: z.string(),
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────
import { NextRequest } from 'next/server';
import { POST } from '../route';

import { sendNotification } from '@/lib/notifications/dispatcher';
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
const mockSend = sendNotification as jest.MockedFunction<typeof sendNotification>;
const mockTrigger = triggerUptimizeAIAgent as jest.MockedFunction<typeof triggerUptimizeAIAgent>;
const mockVerifyMember = verifyMember as jest.MockedFunction<typeof verifyMember>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockAchievements = checkAchievementsForMember as jest.MockedFunction<typeof checkAchievementsForMember>;
const mockFeedEvents = generateSessionFeedEvents as jest.MockedFunction<typeof generateSessionFeedEvents>;
const mockChallengeScores = updateChallengeScores as jest.MockedFunction<typeof updateChallengeScores>;
const mockRefreshReadiness = invalidateAndRefreshReadiness as jest.MockedFunction<typeof invalidateAndRefreshReadiness>;
const mockRefreshMuscleMap = invalidateAndRefreshMuscleMap as jest.MockedFunction<typeof invalidateAndRefreshMuscleMap>;
const mockValidateUUIDs = validateUUIDs as jest.MockedFunction<typeof validateUUIDs>;

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
const GYM_ID = 'c3d4e5f6-a7b8-9012-cdef-012345678902';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStreakContinuingDates(count: number): string[] {
  const base = new Date('2024-01-15');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getTime() - i * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
}

function buildAdmin(opts: {
  currentStreak?: number;
  recentDates?: string[];
  isPersonalBest?: boolean;
}) {
  const { currentStreak = 3, recentDates = makeStreakContinuingDates(3), isPersonalBest = false } = opts;
  let wsCallNum = 0;

  const from = jest.fn((table: string) => {
    if (table === 'members') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                smartgym_score: 1000,
                best_streak: currentStreak,
                current_streak: currentStreak,
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
        // Atomic completion claim (update → eq → eq → is → select → maybeSingle)
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: SESSION_ID,
                        gym_id: GYM_ID,
                        member_id: MEMBER_ID,
                        sets_count: 3,
                        total_volume_lbs: 300,
                        best_weight_lbs: 100,
                        is_personal_best: isPersonalBest,
                        session_date: '2024-01-15',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          select: jest.fn(),
        };
      }
      if (wsCallNum === 2) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: recentDates.map(d => ({ session_date: d })),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (wsCallNum === 3) {
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

describe('POST /api/sessions/[sessionId]/complete — push integration (06-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue(null);
    mockValidateUUIDs.mockReturnValue(null);
    mockTrigger.mockResolvedValue({ success: true });
    mockSend.mockResolvedValue('sent');
    mockFeedEvents.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof generateSessionFeedEvents>>);
    mockChallengeScores.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof updateChallengeScores>>);
    mockRefreshReadiness.mockResolvedValue(undefined);
    mockRefreshMuscleMap.mockResolvedValue(undefined);
    mockAchievements.mockResolvedValue({ leveledUp: false, newLevel: null, newAchievements: [] });

    const admin = buildAdmin({ currentStreak: 3, recentDates: makeStreakContinuingDates(3) });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID } as unknown as Awaited<ReturnType<typeof verifyMember>>);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Core coalescer integration
  // ─────────────────────────────────────────────────────────────────────────

  it('sends exactly ONE push (level_up) when session causes level-up', async () => {
    mockAchievements.mockResolvedValue({
      leveledUp: true,
      newLevel: { level: 5, name: 'Gold', color: '#FFD700' },
      newAchievements: [],
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    // Allow fire-and-forget to settle
    await new Promise(resolve => setImmediate(resolve));

    // Exactly one sendNotification call, type must be level_up
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.type).toBe('level_up');
    expect(call.member_id).toBe(MEMBER_ID);
    expect(call.gym_id).toBe(GYM_ID);
  });

  it('sends ZERO pushes for a plain session (no PR, no badge, no level, no milestone)', async () => {
    // Default mocks: no achievements, streak=3 (non-milestone), previousStreak=3 (continuing)
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    await new Promise(resolve => setImmediate(resolve));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends exactly ONE push (pr_achieved) when session is personal best with no higher-priority events', async () => {
    const admin = buildAdmin({ currentStreak: 3, recentDates: makeStreakContinuingDates(3), isPersonalBest: true });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID } as unknown as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    await new Promise(resolve => setImmediate(resolve));

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].type).toBe('pr_achieved');
  });

  it('only sends level_up (not pr_achieved) when both events coalesce — barrage prevention', async () => {
    mockAchievements.mockResolvedValue({
      leveledUp: true,
      newLevel: { level: 3, name: 'Bronze', color: '#CD7F32' },
      newAchievements: [{ code: 'badge-1', title: 'First Badge', points: 100 }],
    });
    const admin = buildAdmin({ currentStreak: 7, recentDates: makeStreakContinuingDates(7), isPersonalBest: true });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID } as unknown as Awaited<ReturnType<typeof verifyMember>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    await new Promise(resolve => setImmediate(resolve));

    // Despite PR + badge + streak milestone, only ONE push total, type = level_up
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].type).toBe('level_up');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Route resilience
  // ─────────────────────────────────────────────────────────────────────────

  it('still returns 200 when sendNotification rejects (fire-and-forget)', async () => {
    mockSend.mockRejectedValue(new Error('Push service unavailable'));
    mockAchievements.mockResolvedValue({
      leveledUp: true,
      newLevel: { level: 2, name: 'Silver', color: '#C0C0C0' },
      newAchievements: [],
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Existing agent triggers unchanged
  // ─────────────────────────────────────────────────────────────────────────

  it('still fires leaderboard-updated agent trigger (existing behavior preserved)', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const lbCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'leaderboard-updated'
    );
    expect(lbCalls).toHaveLength(1);
  });

  it('still fires level-up agent trigger when achievements.leveledUp is true (existing behavior preserved)', async () => {
    mockAchievements.mockResolvedValue({
      leveledUp: true,
      newLevel: { level: 5, name: 'Gold', color: '#FFD700' },
      newAchievements: [],
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const levelUpCalls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      c => c[1]?.event === 'level-up'
    );
    expect(levelUpCalls).toHaveLength(1);
    expect(levelUpCalls[0][1].event).toBe('level-up');
  });
});
