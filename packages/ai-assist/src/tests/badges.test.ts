import { describe, it, expect } from 'vitest';
import { checkBadgeUnlocks, BadgeCheckInput } from '../rules/badges';

// ─── Helpers ────────────────────────────────────────────

const ZERO_STATS: BadgeCheckInput = {
  completedWorkouts: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalVolumeKg: 0,
  totalPRs: 0,
  totalPoints: 0,
  alreadyUnlockedSlugs: [],
};

function withStats(overrides: Partial<BadgeCheckInput>): BadgeCheckInput {
  return { ...ZERO_STATS, ...overrides };
}

// ─── Tests ──────────────────────────────────────────────

describe('checkBadgeUnlocks', () => {
  it('returns empty array for zero stats', () => {
    const result = checkBadgeUnlocks(ZERO_STATS);
    expect(result).toEqual([]);
  });

  it('unlocks first_workout at 1 completed workout', () => {
    const result = checkBadgeUnlocks(withStats({ completedWorkouts: 1 }));
    expect(result).toContain('first_workout');
  });

  it('unlocks workouts_10 at 10 workouts (cascading with first_workout)', () => {
    const result = checkBadgeUnlocks(withStats({ completedWorkouts: 10 }));
    expect(result).toContain('first_workout');
    expect(result).toContain('workouts_10');
  });

  it('unlocks workouts_50 at 50 workouts', () => {
    const result = checkBadgeUnlocks(withStats({ completedWorkouts: 50 }));
    expect(result).toContain('workouts_50');
  });

  it('unlocks workouts_100 at 100 workouts (all workout badges)', () => {
    const result = checkBadgeUnlocks(withStats({ completedWorkouts: 100 }));
    expect(result).toContain('first_workout');
    expect(result).toContain('workouts_10');
    expect(result).toContain('workouts_50');
    expect(result).toContain('workouts_100');
  });

  it('unlocks streak_4 using longestStreak (not currentStreak)', () => {
    const result = checkBadgeUnlocks(withStats({ currentStreak: 2, longestStreak: 4 }));
    expect(result).toContain('streak_4');
  });

  it('unlocks streak_12 at longestStreak >= 12', () => {
    const result = checkBadgeUnlocks(withStats({ longestStreak: 12 }));
    expect(result).toContain('streak_4');
    expect(result).toContain('streak_12');
  });

  it('unlocks total_volume_10k at 10000 kg', () => {
    const result = checkBadgeUnlocks(withStats({ totalVolumeKg: 10000 }));
    expect(result).toContain('total_volume_10k');
    expect(result).not.toContain('total_volume_100k');
  });

  it('unlocks total_volume_100k at 100000 kg', () => {
    const result = checkBadgeUnlocks(withStats({ totalVolumeKg: 100000 }));
    expect(result).toContain('total_volume_10k');
    expect(result).toContain('total_volume_100k');
  });

  it('unlocks prs_5 at 5 PRs', () => {
    const result = checkBadgeUnlocks(withStats({ totalPRs: 5 }));
    expect(result).toContain('prs_5');
    expect(result).not.toContain('prs_25');
  });

  it('unlocks prs_25 at 25 PRs', () => {
    const result = checkBadgeUnlocks(withStats({ totalPRs: 25 }));
    expect(result).toContain('prs_5');
    expect(result).toContain('prs_25');
  });

  it('unlocks points_500 at 500 points', () => {
    const result = checkBadgeUnlocks(withStats({ totalPoints: 500 }));
    expect(result).toContain('points_500');
    expect(result).not.toContain('points_5000');
  });

  it('unlocks points_5000 at 5000 points', () => {
    const result = checkBadgeUnlocks(withStats({ totalPoints: 5000 }));
    expect(result).toContain('points_500');
    expect(result).toContain('points_5000');
  });

  it('filters out already-unlocked badges', () => {
    const result = checkBadgeUnlocks(withStats({
      completedWorkouts: 100,
      alreadyUnlockedSlugs: ['first_workout', 'workouts_10', 'workouts_50'],
    }));
    expect(result).not.toContain('first_workout');
    expect(result).not.toContain('workouts_10');
    expect(result).not.toContain('workouts_50');
    expect(result).toContain('workouts_100');
  });

  it('unlocks multiple categories simultaneously', () => {
    const result = checkBadgeUnlocks(withStats({
      completedWorkouts: 10,
      longestStreak: 4,
      totalVolumeKg: 10000,
      totalPRs: 5,
      totalPoints: 500,
    }));
    expect(result).toContain('first_workout');
    expect(result).toContain('workouts_10');
    expect(result).toContain('streak_4');
    expect(result).toContain('total_volume_10k');
    expect(result).toContain('prs_5');
    expect(result).toContain('points_500');
  });

  it('returns empty when below all thresholds', () => {
    const result = checkBadgeUnlocks(withStats({
      completedWorkouts: 0,
      longestStreak: 3,
      totalVolumeKg: 9999,
      totalPRs: 4,
      totalPoints: 499,
    }));
    expect(result).toEqual([]);
  });
});
