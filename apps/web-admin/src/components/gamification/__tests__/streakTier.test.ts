import { getStreakTier, STREAK_TIER_CONFIG } from '../streakTier';

// ── Tier boundaries — DOC_03 §8: 0 / 1–6 / 7–20 / 21–49 / 50–99 / 100+ ──

describe('getStreakTier', () => {
  test('T1: 0 days (and negatives) → tier 0 (cold)', () => {
    expect(getStreakTier(0)).toBe(0);
    expect(getStreakTier(-1)).toBe(0);
  });

  test('T2: 1–6 days → tier 1 (warm)', () => {
    expect(getStreakTier(1)).toBe(1);
    expect(getStreakTier(3)).toBe(1);
    expect(getStreakTier(6)).toBe(1);
  });

  test('T3: 7–20 days → tier 2 (hot)', () => {
    expect(getStreakTier(7)).toBe(2);
    expect(getStreakTier(14)).toBe(2);
    expect(getStreakTier(20)).toBe(2);
  });

  test('T4: 21–49 days → tier 3 (fire)', () => {
    expect(getStreakTier(21)).toBe(3);
    expect(getStreakTier(35)).toBe(3);
    expect(getStreakTier(49)).toBe(3);
  });

  test('T5: 50–99 days → tier 4 (inferno)', () => {
    expect(getStreakTier(50)).toBe(4);
    expect(getStreakTier(75)).toBe(4);
    expect(getStreakTier(99)).toBe(4);
  });

  test('T6: 100+ days → tier 5 (legend)', () => {
    expect(getStreakTier(100)).toBe(5);
    expect(getStreakTier(365)).toBe(5);
    expect(getStreakTier(10000)).toBe(5);
  });
});

describe('STREAK_TIER_CONFIG', () => {
  test('T7: sizes grow with tier per spec (16→20→24→28→32→36)', () => {
    expect(STREAK_TIER_CONFIG[0].size).toBe(16);
    expect(STREAK_TIER_CONFIG[1].size).toBe(20);
    expect(STREAK_TIER_CONFIG[2].size).toBe(24);
    expect(STREAK_TIER_CONFIG[3].size).toBe(28);
    expect(STREAK_TIER_CONFIG[4].size).toBe(32);
    expect(STREAK_TIER_CONFIG[5].size).toBe(36);
  });

  test('T8: tier 0 is static (no sway, no flicker, no glow, no particles)', () => {
    const cold = STREAK_TIER_CONFIG[0];
    expect(cold.swaySpeed).toBe(0);
    expect(cold.amplitude).toBe(0);
    expect(cold.flicker).toBe(false);
    expect(cold.particles).toBe(false);
    expect(cold.glowColor).toBe('transparent');
  });

  test('T9: sway speeds up as tiers rise (2s → 0.6s)', () => {
    expect(STREAK_TIER_CONFIG[1].swaySpeed).toBe(2000);
    expect(STREAK_TIER_CONFIG[2].swaySpeed).toBe(1500);
    expect(STREAK_TIER_CONFIG[3].swaySpeed).toBe(1000);
    expect(STREAK_TIER_CONFIG[4].swaySpeed).toBe(800);
    expect(STREAK_TIER_CONFIG[5].swaySpeed).toBe(600);
  });

  test('T10: flicker only on tiers 3+', () => {
    expect(STREAK_TIER_CONFIG[1].flicker).toBe(false);
    expect(STREAK_TIER_CONFIG[2].flicker).toBe(false);
    expect(STREAK_TIER_CONFIG[3].flicker).toBe(true);
    expect(STREAK_TIER_CONFIG[4].flicker).toBe(true);
    expect(STREAK_TIER_CONFIG[5].flicker).toBe(true);
  });

  test('T11: only tier 5 has legend particles', () => {
    expect(STREAK_TIER_CONFIG[4].particles).toBe(false);
    expect(STREAK_TIER_CONFIG[5].particles).toBe(true);
  });

  test('T12: tier colors reference the --streak-* tokens', () => {
    expect(STREAK_TIER_CONFIG[0].color).toContain('--streak-cold');
    expect(STREAK_TIER_CONFIG[1].color).toContain('--streak-warm');
    expect(STREAK_TIER_CONFIG[2].color).toContain('--streak-hot');
    expect(STREAK_TIER_CONFIG[3].color).toContain('--streak-fire');
    expect(STREAK_TIER_CONFIG[4].color).toContain('--streak-inferno');
    expect(STREAK_TIER_CONFIG[5].color).toContain('--streak-legend');
  });

  test('T13: amplitude rises with tier (3→4→5→6→8 deg)', () => {
    expect(STREAK_TIER_CONFIG[1].amplitude).toBe(3);
    expect(STREAK_TIER_CONFIG[2].amplitude).toBe(4);
    expect(STREAK_TIER_CONFIG[3].amplitude).toBe(5);
    expect(STREAK_TIER_CONFIG[4].amplitude).toBe(6);
    expect(STREAK_TIER_CONFIG[5].amplitude).toBe(8);
  });
});
