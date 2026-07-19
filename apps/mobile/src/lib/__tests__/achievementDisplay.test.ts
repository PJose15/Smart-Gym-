import {
  getBadgeProgress,
  RARITY_BORDER_COLORS,
  RARITY_XP,
} from '../achievementDisplay';
import { colors } from '../../theme/colors';

describe('RARITY_BORDER_COLORS', () => {
  // Stitch Red-Luxury: common textMuted, rare info blue, epic crimson, legendary gold
  it('matches spec colors via tokens', () => {
    expect(RARITY_BORDER_COLORS.common).toBe(colors.textMuted);
    expect(RARITY_BORDER_COLORS.rare).toBe(colors.info);
    expect(RARITY_BORDER_COLORS.epic).toBe(colors.primary);
    expect(RARITY_BORDER_COLORS.legendary).toBe(colors.gold);
  });
});

describe('RARITY_XP', () => {
  it('scales with rarity', () => {
    expect(RARITY_XP.common).toBeLessThan(RARITY_XP.rare);
    expect(RARITY_XP.rare).toBeLessThan(RARITY_XP.epic);
    expect(RARITY_XP.epic).toBeLessThan(RARITY_XP.legendary);
  });
});

describe('getBadgeProgress', () => {
  it('derives workout-count progress', () => {
    const progress = getBadgeProgress('workouts_10', 10, { completedWorkouts: 3 });
    expect(progress).not.toBeNull();
    expect(progress!.current).toBe(3);
    expect(progress!.target).toBe(10);
    expect(progress!.ratio).toBeCloseTo(0.3);
    expect(progress!.label).toContain('3/10');
    expect(progress!.label).toContain('7 to go');
  });

  it('derives streak progress from longestStreak (weeks)', () => {
    const progress = getBadgeProgress('streak_4', 4, { longestStreak: 2 });
    expect(progress).not.toBeNull();
    expect(progress!.current).toBe(2);
    expect(progress!.ratio).toBe(0.5);
    expect(progress!.label).toContain('weeks');
  });

  it('derives points progress', () => {
    const progress = getBadgeProgress('points_500', 500, { totalPoints: 450 });
    expect(progress!.current).toBe(450);
    expect(progress!.label).toContain('50 to go');
  });

  it('derives volume progress with kg unit', () => {
    const progress = getBadgeProgress('total_volume_10k', 10000, { totalVolumeKg: 2500 });
    expect(progress!.ratio).toBe(0.25);
    expect(progress!.label).toContain('kg');
  });

  it('returns null when the required stat is unavailable', () => {
    expect(getBadgeProgress('workouts_10', 10, {})).toBeNull();
    expect(getBadgeProgress('prs_5', 5, { completedWorkouts: 3 })).toBeNull();
    expect(getBadgeProgress('streak_4', 4, { totalPoints: 100 })).toBeNull();
  });

  it('clamps overshoot to the target (ready to unlock)', () => {
    const progress = getBadgeProgress('workouts_10', 10, { completedWorkouts: 25 });
    expect(progress!.current).toBe(10);
    expect(progress!.ratio).toBe(1);
    expect(progress!.label).toContain('Ready to unlock');
  });

  it('rejects invalid criteria values', () => {
    expect(getBadgeProgress('workouts_10', 0, { completedWorkouts: 3 })).toBeNull();
    expect(getBadgeProgress('workouts_10', NaN, { completedWorkouts: 3 })).toBeNull();
  });

  it('handles NaN stat values as unavailable', () => {
    expect(getBadgeProgress('workouts_10', 10, { completedWorkouts: NaN })).toBeNull();
  });
});
