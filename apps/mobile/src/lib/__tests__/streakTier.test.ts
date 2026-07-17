import {
  getStreakTier,
  getStreakTierFromWeeks,
  STREAK_TIER_CONFIG,
} from '../streakTier';
import { colors } from '../../theme/colors';

describe('getStreakTier', () => {
  // DOC_03 Section 8 thresholds: 0 / 1–6 / 7–20 / 21–49 / 50–99 / 100+
  it('returns tier 0 (Cold) for 0 days', () => {
    expect(getStreakTier(0)).toBe(0);
  });

  it('returns tier 1 (Warm) for 1–6 days', () => {
    expect(getStreakTier(1)).toBe(1);
    expect(getStreakTier(3)).toBe(1);
    expect(getStreakTier(6)).toBe(1);
  });

  it('returns tier 2 (Hot) for 7–20 days', () => {
    expect(getStreakTier(7)).toBe(2);
    expect(getStreakTier(14)).toBe(2);
    expect(getStreakTier(20)).toBe(2);
  });

  it('returns tier 3 (Fire) for 21–49 days', () => {
    expect(getStreakTier(21)).toBe(3);
    expect(getStreakTier(35)).toBe(3);
    expect(getStreakTier(49)).toBe(3);
  });

  it('returns tier 4 (Inferno) for 50–99 days', () => {
    expect(getStreakTier(50)).toBe(4);
    expect(getStreakTier(75)).toBe(4);
    expect(getStreakTier(99)).toBe(4);
  });

  it('returns tier 5 (Legend) for 100+ days', () => {
    expect(getStreakTier(100)).toBe(5);
    expect(getStreakTier(365)).toBe(5);
  });

  it('treats negative and non-finite input as tier 0', () => {
    expect(getStreakTier(-5)).toBe(0);
    expect(getStreakTier(NaN)).toBe(0);
    expect(getStreakTier(Infinity)).toBe(5); // finite check only guards NaN; Infinity is a huge streak
  });
});

describe('getStreakTierFromWeeks', () => {
  it('converts weeks to days (weeks * 7)', () => {
    expect(getStreakTierFromWeeks(0)).toBe(0);
    expect(getStreakTierFromWeeks(1)).toBe(2);  // 7 days → Hot
    expect(getStreakTierFromWeeks(2)).toBe(2);  // 14 days → Hot
    expect(getStreakTierFromWeeks(3)).toBe(3);  // 21 days → Fire
    expect(getStreakTierFromWeeks(7)).toBe(3);  // 49 days → Fire
    expect(getStreakTierFromWeeks(8)).toBe(4);  // 56 days → Inferno
    expect(getStreakTierFromWeeks(14)).toBe(4); // 98 days → Inferno
    expect(getStreakTierFromWeeks(15)).toBe(5); // 105 days → Legend
  });

  it('treats negative and NaN weeks as tier 0', () => {
    expect(getStreakTierFromWeeks(-1)).toBe(0);
    expect(getStreakTierFromWeeks(NaN)).toBe(0);
  });
});

describe('STREAK_TIER_CONFIG', () => {
  it('uses the streak color tokens per tier', () => {
    expect(STREAK_TIER_CONFIG[0].color).toBe(colors.streakCold);
    expect(STREAK_TIER_CONFIG[1].color).toBe(colors.streakWarm);
    expect(STREAK_TIER_CONFIG[2].color).toBe(colors.streakHot);
    expect(STREAK_TIER_CONFIG[3].color).toBe(colors.streakFire);
    expect(STREAK_TIER_CONFIG[4].color).toBe(colors.streakInferno);
    expect(STREAK_TIER_CONFIG[5].color).toBe(colors.streakLegend);
  });

  it('sizes grow 16 → 36px across tiers', () => {
    expect(STREAK_TIER_CONFIG[0].size).toBe(16);
    expect(STREAK_TIER_CONFIG[1].size).toBe(20);
    expect(STREAK_TIER_CONFIG[2].size).toBe(24);
    expect(STREAK_TIER_CONFIG[3].size).toBe(28);
    expect(STREAK_TIER_CONFIG[4].size).toBe(32);
    expect(STREAK_TIER_CONFIG[5].size).toBe(36);
  });

  it('only tiers 3–5 flicker', () => {
    expect(STREAK_TIER_CONFIG[0].flicker).toBe(false);
    expect(STREAK_TIER_CONFIG[1].flicker).toBe(false);
    expect(STREAK_TIER_CONFIG[2].flicker).toBe(false);
    expect(STREAK_TIER_CONFIG[3].flicker).toBe(true);
    expect(STREAK_TIER_CONFIG[4].flicker).toBe(true);
    expect(STREAK_TIER_CONFIG[5].flicker).toBe(true);
  });

  it('tier 0 is static (no sway) with no glow', () => {
    expect(STREAK_TIER_CONFIG[0].speed).toBe(0);
    expect(STREAK_TIER_CONFIG[0].amplitude).toBe(0);
    expect(STREAK_TIER_CONFIG[0].glowColor).toBe('transparent');
  });

  it('sway speeds up as tiers rise', () => {
    const speeds = [1, 2, 3, 4, 5].map((t) => STREAK_TIER_CONFIG[t as 1 | 2 | 3 | 4 | 5].speed);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThan(speeds[i - 1]);
    }
  });
});
