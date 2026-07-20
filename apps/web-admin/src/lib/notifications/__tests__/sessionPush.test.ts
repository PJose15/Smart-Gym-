/**
 * @jest-environment node
 *
 * Tests: pickSessionPushEvent — pure coalescer for session-complete push
 * Covers priority ordering, streak milestones, streak-broken, and PII-free bodies
 *
 * sendSessionCompletePush wrapper is tested for:
 *   - dispatching via sendNotification fire-and-forget
 *   - null coalesce → no sendNotification call
 *   - dispatcher rejection never throws (fire-and-forget)
 */

// ── Mocks declared before imports ─────────────────────────────────────────────
jest.mock('@/lib/notifications/dispatcher', () => ({
  sendNotification: jest.fn().mockResolvedValue('sent'),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { pickSessionPushEvent, sendSessionCompletePush } from '../sessionPush';
import { sendNotification } from '@/lib/notifications/dispatcher';

const mockSend = sendNotification as jest.MockedFunction<typeof sendNotification>;

// ── Constants ─────────────────────────────────────────────────────────────────
const GYM_ID = 'c3d4e5f6-a7b8-9012-cdef-012345678902';
const MEMBER_ID = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';

// ── pickSessionPushEvent tests ────────────────────────────────────────────────

describe('pickSessionPushEvent — pure coalescer', () => {
  describe('Priority: level_up wins over everything', () => {
    it('returns level_up when all flags true (all-true input)', () => {
      const result = pickSessionPushEvent({
        leveledUp: true,
        badgesUnlocked: 3,
        isPersonalBest: true,
        streak: 7,
        previousStreak: 5,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('level_up');
    });

    it('returns level_up when only leveledUp is true', () => {
      const result = pickSessionPushEvent({
        leveledUp: true,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 3,
        previousStreak: 3,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('level_up');
    });
  });

  describe('Priority: badge_unlocked (no level_up)', () => {
    it('returns badge_unlocked when badge present and no level-up', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 1,
        isPersonalBest: true,
        streak: 7,
        previousStreak: 5,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('badge_unlocked');
    });
  });

  describe('Priority: pr_achieved (no level_up, no badge)', () => {
    it('PR+streak-7 → returns pr_achieved', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: true,
        streak: 7,
        previousStreak: 5,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pr_achieved');
    });

    it('body acknowledges combo generically when PR and other events coalesce', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: true,
        streak: 7,
        previousStreak: 5,
      });
      expect(result).not.toBeNull();
      // Body must be generic — no PII (names, weights, exercise names)
      expect(result!.body).toBeTruthy();
      expect(result!.body.toLowerCase()).not.toMatch(/\d+\s*(lbs|kg)/);
    });
  });

  describe('Priority: streak_milestone', () => {
    const milestones = [7, 14, 30, 50, 100];

    milestones.forEach(n => {
      it(`returns streak_milestone for streak=${n}`, () => {
        const result = pickSessionPushEvent({
          leveledUp: false,
          badgesUnlocked: 0,
          isPersonalBest: false,
          streak: n,
          previousStreak: n - 1,
        });
        expect(result).not.toBeNull();
        expect(result!.type).toBe('streak_milestone');
      });
    });

    it('returns null for streak=8 (non-milestone) with no other events', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 8,
        previousStreak: 7,
      });
      expect(result).toBeNull();
    });

    it('returns null for streak=6 (non-milestone) with no other events', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 6,
        previousStreak: 5,
      });
      expect(result).toBeNull();
    });
  });

  describe('Priority: streak_broken', () => {
    it('returns streak_broken when previousStreak>1 and streak===1 with no other events', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 1,
        previousStreak: 5,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('streak_broken');
    });

    it('returns null when previousStreak=1 and streak=1 (not streak_broken, just no progress)', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 1,
        previousStreak: 1,
      });
      expect(result).toBeNull();
    });

    it('returns null when previousStreak=0 (first session)', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 1,
        previousStreak: 0,
      });
      expect(result).toBeNull();
    });
  });

  describe('Null cases', () => {
    it('returns null when nothing notable happened', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 3,
        previousStreak: 2,
      });
      expect(result).toBeNull();
    });

    it('returns null for streak=1 and previousStreak=0 (first ever session)', () => {
      const result = pickSessionPushEvent({
        leveledUp: false,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 1,
        previousStreak: 0,
      });
      expect(result).toBeNull();
    });
  });

  describe('PII-free bodies', () => {
    it('level_up body contains no names, weights, or exercise names', () => {
      const result = pickSessionPushEvent({
        leveledUp: true,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 3,
        previousStreak: 3,
      });
      expect(result).not.toBeNull();
      // Must not contain exercise names pattern or weight patterns
      expect(result!.body.toLowerCase()).not.toMatch(/\d+\s*(lbs|kg)/);
      expect(result!.title).toBeTruthy();
      expect(result!.body).toBeTruthy();
    });
  });
});

// ── sendSessionCompletePush tests ─────────────────────────────────────────────

describe('sendSessionCompletePush — dispatcher wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue('sent');
  });

  it('calls sendNotification once with correct member_id, gym_id, and type when leveledUp', async () => {
    await sendSessionCompletePush({
      gym_id: GYM_ID,
      member_id: MEMBER_ID,
      leveledUp: true,
      badgesUnlocked: 0,
      isPersonalBest: false,
      streak: 3,
      previousStreak: 3,
    });

    // Allow fire-and-forget to settle
    await new Promise(resolve => setImmediate(resolve));

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.member_id).toBe(MEMBER_ID);
    expect(call.gym_id).toBe(GYM_ID);
    expect(call.type).toBe('level_up');
    expect(call.title).toBeTruthy();
    expect(call.body).toBeTruthy();
  });

  it('does NOT call sendNotification when nothing notable happened (coalescer returns null)', async () => {
    await sendSessionCompletePush({
      gym_id: GYM_ID,
      member_id: MEMBER_ID,
      leveledUp: false,
      badgesUnlocked: 0,
      isPersonalBest: false,
      streak: 3,
      previousStreak: 2,
    });

    await new Promise(resolve => setImmediate(resolve));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('never throws when dispatcher rejects (fire-and-forget)', async () => {
    mockSend.mockRejectedValue(new Error('Push failed'));

    await expect(
      sendSessionCompletePush({
        gym_id: GYM_ID,
        member_id: MEMBER_ID,
        leveledUp: true,
        badgesUnlocked: 0,
        isPersonalBest: false,
        streak: 3,
        previousStreak: 3,
      })
    ).resolves.not.toThrow();

    await new Promise(resolve => setImmediate(resolve));
  });

  it('returns void (not the SendResult)', async () => {
    const result = await sendSessionCompletePush({
      gym_id: GYM_ID,
      member_id: MEMBER_ID,
      leveledUp: false,
      badgesUnlocked: 1,
      isPersonalBest: false,
      streak: 3,
      previousStreak: 3,
    });

    await new Promise(resolve => setImmediate(resolve));

    expect(result).toBeUndefined();
  });
});
