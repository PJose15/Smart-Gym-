/**
 * Tests for pure challenge logic — tab split, progress, score formatting,
 * countdown, leaderboard pinned-row, join eligibility, icons.
 *
 * Follows the feedLogic.test.ts pattern: node test environment, no React,
 * no Supabase mocks needed for pure functions.
 */
import type { ChallengeListItem, ChallengeParticipant, ChallengeDetail } from '@nexera/types';
import {
  splitByStatus,
  progressPct,
  formatScore,
  countdownLabel,
  buildLeaderboardRows,
  canJoin,
  challengeIcon,
} from '../challengeLogic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChallenge(overrides: Partial<ChallengeListItem> = {}): ChallengeListItem {
  return {
    challenge_id: 'chal-1',
    title: 'Volume King',
    description: 'Lift the most this month',
    challenge_type: 'volume',
    start_date: '2026-07-01T00:00:00.000Z',
    end_date: '2026-07-31T23:59:59.000Z',
    is_active: true,
    is_joined: false,
    my_score: null,
    top_score: 10000,
    rank: 0,
    total_participants: 5,
    progress_pct: 0,
    days_left: 12,
    ...overrides,
  };
}

function makeParticipant(overrides: Partial<ChallengeParticipant> = {}): ChallengeParticipant {
  return {
    member_id: 'mem-1',
    display_name: 'Alice',
    avatar_url: null,
    current_score: 5000,
    current_rank: 1,
    joined_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── splitByStatus ────────────────────────────────────────────────────────────

describe('splitByStatus', () => {
  it('splits active and completed challenges', () => {
    const active1 = makeChallenge({ challenge_id: 'a1', is_active: true, end_date: '2026-07-31T00:00:00.000Z' });
    const active2 = makeChallenge({ challenge_id: 'a2', is_active: true, end_date: '2026-07-25T00:00:00.000Z' });
    const completed = makeChallenge({ challenge_id: 'c1', is_active: false, end_date: '2026-06-30T00:00:00.000Z' });

    const { active, completed: comp } = splitByStatus([active1, active2, completed]);

    expect(active).toHaveLength(2);
    expect(comp).toHaveLength(1);
    expect(comp[0].challenge_id).toBe('c1');
  });

  it('sorts active by end_date ascending (soonest ending first)', () => {
    const soon = makeChallenge({ challenge_id: 'soon', is_active: true, end_date: '2026-07-15T00:00:00.000Z' });
    const later = makeChallenge({ challenge_id: 'later', is_active: true, end_date: '2026-07-31T00:00:00.000Z' });

    const { active } = splitByStatus([later, soon]);

    expect(active[0].challenge_id).toBe('soon');
    expect(active[1].challenge_id).toBe('later');
  });

  it('sorts completed by end_date descending (most recently ended first)', () => {
    const older = makeChallenge({ challenge_id: 'older', is_active: false, end_date: '2026-05-31T00:00:00.000Z' });
    const recent = makeChallenge({ challenge_id: 'recent', is_active: false, end_date: '2026-06-30T00:00:00.000Z' });

    const { completed } = splitByStatus([older, recent]);

    expect(completed[0].challenge_id).toBe('recent');
    expect(completed[1].challenge_id).toBe('older');
  });

  it('handles empty list', () => {
    const { active, completed } = splitByStatus([]);
    expect(active).toHaveLength(0);
    expect(completed).toHaveLength(0);
  });

  it('handles all active', () => {
    const list = [makeChallenge({ challenge_id: 'a' }), makeChallenge({ challenge_id: 'b' })];
    const { active, completed } = splitByStatus(list);
    expect(active).toHaveLength(2);
    expect(completed).toHaveLength(0);
  });
});

// ─── progressPct ─────────────────────────────────────────────────────────────

describe('progressPct', () => {
  it('returns (my / top) * 100 for normal case', () => {
    expect(progressPct(5000, 10000)).toBe(50);
  });

  it('returns 0 when myScore is null', () => {
    expect(progressPct(null, 10000)).toBe(0);
  });

  it('returns 0 when topScore <= 0', () => {
    expect(progressPct(100, 0)).toBe(0);
    expect(progressPct(100, -5)).toBe(0);
  });

  it('returns 0 when myScore is negative', () => {
    expect(progressPct(-10, 10000)).toBe(0);
  });

  it('returns 100 when myScore >= topScore', () => {
    expect(progressPct(10000, 10000)).toBe(100);
    expect(progressPct(15000, 10000)).toBe(100);
  });

  it('clamps to 0-100 range', () => {
    expect(progressPct(0, 100)).toBe(0);
    expect(progressPct(100, 100)).toBe(100);
  });

  it('returns fractional percentages accurately', () => {
    expect(progressPct(1, 3)).toBeCloseTo(33.33, 1);
  });
});

// ─── formatScore ─────────────────────────────────────────────────────────────

describe('formatScore', () => {
  it('formats volume score in lbs as locale-grouped integer', () => {
    expect(formatScore(12340, 'volume', 'lbs')).toBe('12,340 lbs');
  });

  it('formats volume score converting lbs → kg', () => {
    // 12340 lbs * 0.45359237 = 5597.33..., rounded to integer = 5,597 kg
    const result = formatScore(12340, 'volume', 'kg');
    expect(result).toMatch(/kg$/);
    expect(result).toBe('5,597 kg');
  });

  it('formats pr score in lbs', () => {
    expect(formatScore(225, 'pr', 'lbs')).toBe('225 lbs');
  });

  it('formats pr score in kg', () => {
    // 225 * 0.45359237 = 102.058... → 102 kg
    expect(formatScore(225, 'pr', 'kg')).toBe('102 kg');
  });

  it('formats sessions score as "N sessions"', () => {
    expect(formatScore(10, 'sessions', 'lbs')).toBe('10 sessions');
    expect(formatScore(1, 'sessions', 'kg')).toBe('1 sessions');
  });

  it('formats streak score as "N days"', () => {
    expect(formatScore(7, 'streak', 'lbs')).toBe('7 days');
  });

  it('formats machine_explorer score as "N machines"', () => {
    expect(formatScore(5, 'machine_explorer', 'lbs')).toBe('5 machines');
  });

  it('formats team/custom score as plain integer', () => {
    expect(formatScore(42, 'team', 'lbs')).toBe('42');
    expect(formatScore(99, 'custom', 'lbs')).toBe('99');
  });
});

// ─── countdownLabel ───────────────────────────────────────────────────────────

describe('countdownLabel', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('returns "Xd left" for challenges ending more than 1 day in the future', () => {
    const endDate = '2026-07-20T12:00:00.000Z'; // 5 days away
    expect(countdownLabel(endDate, now)).toBe('5d left');
  });

  it('returns "Ends today" for challenges ending within the same day (<=1d)', () => {
    const endDate = '2026-07-15T23:59:59.000Z'; // same day, <1d away
    expect(countdownLabel(endDate, now)).toBe('Ends today');
  });

  it('returns "Ends today" when exactly 1 day away', () => {
    const endDate = '2026-07-16T12:00:00.000Z'; // exactly 24h, <=1d
    expect(countdownLabel(endDate, now)).toBe('Ends today');
  });

  it('returns "Ended" for past end dates', () => {
    const endDate = '2026-07-10T12:00:00.000Z'; // 5 days ago
    expect(countdownLabel(endDate, now)).toBe('Ended');
  });

  it('returns "Ended" when end date equals now', () => {
    const endDate = '2026-07-15T12:00:00.000Z'; // same instant
    expect(countdownLabel(endDate, now)).toBe('Ended');
  });
});

// ─── buildLeaderboardRows ─────────────────────────────────────────────────────

describe('buildLeaderboardRows', () => {
  const participants = Array.from({ length: 12 }, (_, i) =>
    makeParticipant({
      member_id: `mem-${i + 1}`,
      display_name: `Member ${i + 1}`,
      current_rank: i + 1,
      current_score: 10000 - i * 500,
    }),
  );

  it('returns top 10 rows by default', () => {
    const { top, pinnedMe } = buildLeaderboardRows(participants, 'mem-1');
    expect(top).toHaveLength(10);
    expect(pinnedMe).toBeNull(); // mem-1 is rank 1 (inside top 10)
  });

  it('pins my row when rank is exactly 11 (outside topN=10)', () => {
    const { top, pinnedMe } = buildLeaderboardRows(participants, 'mem-11');
    expect(top).toHaveLength(10);
    expect(pinnedMe).not.toBeNull();
    expect(pinnedMe?.member_id).toBe('mem-11');
  });

  it('does not pin my row when rank is exactly 10 (inside topN)', () => {
    const { top, pinnedMe } = buildLeaderboardRows(participants, 'mem-10');
    expect(top).toHaveLength(10);
    expect(pinnedMe).toBeNull();
  });

  it('returns pinnedMe null when member is not a participant', () => {
    const { top, pinnedMe } = buildLeaderboardRows(participants, 'non-existent');
    expect(top).toHaveLength(10);
    expect(pinnedMe).toBeNull();
  });

  it('handles empty participants array', () => {
    const { top, pinnedMe } = buildLeaderboardRows([], 'mem-1');
    expect(top).toHaveLength(0);
    expect(pinnedMe).toBeNull();
  });

  it('respects custom topN parameter', () => {
    const { top, pinnedMe } = buildLeaderboardRows(participants, 'mem-6', 5);
    expect(top).toHaveLength(5);
    expect(pinnedMe).not.toBeNull(); // mem-6 rank=6 > topN=5
    expect(pinnedMe?.member_id).toBe('mem-6');
  });

  it('returns null pinnedMe when fewer participants than topN', () => {
    const small = participants.slice(0, 3);
    const { top, pinnedMe } = buildLeaderboardRows(small, 'mem-3', 10);
    expect(top).toHaveLength(3);
    expect(pinnedMe).toBeNull(); // all 3 are in top
  });
});

// ─── canJoin ─────────────────────────────────────────────────────────────────

describe('canJoin', () => {
  function makeDetail(overrides: Partial<ChallengeDetail> = {}): ChallengeDetail {
    return {
      ...makeChallenge({ is_active: true, is_joined: false }),
      entry_mode: 'open',
      prize_type: null,
      prize_description: null,
      participants: [],
      my_participation: null,
      ...overrides,
    };
  }

  it('returns true for active, unjoined, open challenge', () => {
    expect(canJoin(makeDetail())).toBe(true);
  });

  it('returns false when already joined', () => {
    expect(canJoin(makeDetail({ is_joined: true }))).toBe(false);
  });

  it('returns false when not active', () => {
    expect(canJoin(makeDetail({ is_active: false }))).toBe(false);
  });

  it('returns false when entry_mode is "invite"', () => {
    expect(canJoin(makeDetail({ entry_mode: 'invite' }))).toBe(false);
  });

  it('returns true for opt-in entry mode when active and not joined', () => {
    expect(canJoin(makeDetail({ entry_mode: 'opt-in' }))).toBe(true);
  });
});

// ─── challengeIcon ────────────────────────────────────────────────────────────

describe('challengeIcon', () => {
  it('returns the correct emoji for each of the 7 types', () => {
    expect(challengeIcon('volume')).toBe('🏋️');
    expect(challengeIcon('sessions')).toBe('💪');
    expect(challengeIcon('pr')).toBe('🏆');
    expect(challengeIcon('streak')).toBe('🔥');
    expect(challengeIcon('machine_explorer')).toBe('🗺️');
    expect(challengeIcon('team')).toBe('🤝');
    expect(challengeIcon('custom')).toBe('🎯');
  });

  it('falls back to "🎯" for unknown types', () => {
    expect(challengeIcon('mystery_type')).toBe('🎯');
    expect(challengeIcon('')).toBe('🎯');
  });
});
