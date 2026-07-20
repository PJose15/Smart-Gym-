/**
 * Streak Flame tier logic — DOC_03 Section 8.
 *
 * | Tier | Streak (days) | Feel     |
 * |------|---------------|----------|
 * | 0    | 0             | Dead     |
 * | 1    | 1–6           | Starting |
 * | 2    | 7–20          | Building |
 * | 3    | 21–49         | Burning  |
 * | 4    | 50–99         | Roaring  |
 * | 5    | 100+          | Mythic   |
 */

export type StreakTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface StreakTierConfig {
  /** Flame body color — CSS token with spec hex fallback */
  color: string;
  /** Flame width in px (height = size * 1.3) */
  size: number;
  /** Drop-shadow glow color (transparent for tier 0) */
  glowColor: string;
  /** Glow blur radius in px */
  glowSize: number;
  /** Full sway cycle duration in ms (0 = no animation) */
  swaySpeed: number;
  /** Sway amplitude in degrees */
  amplitude: number;
  /** Whether the flame has the fast scale flicker (tier 3+) */
  flicker: boolean;
  /** Flicker cycle duration in ms */
  flickerSpeed: number;
  /** Tier 5 only — purple particle sparkles */
  particles: boolean;
}

export function getStreakTier(streakDays: number): StreakTier {
  if (streakDays <= 0) return 0;
  if (streakDays < 7) return 1;
  if (streakDays < 21) return 2;
  if (streakDays < 50) return 3;
  if (streakDays < 100) return 4;
  return 5;
}

export const STREAK_TIER_CONFIG: Record<StreakTier, StreakTierConfig> = {
  0: {
    color: 'var(--streak-cold, #6B6870)',
    size: 16,
    glowColor: 'transparent',
    glowSize: 0,
    swaySpeed: 0,
    amplitude: 0,
    flicker: false,
    flickerSpeed: 0,
    particles: false,
  },
  1: {
    color: 'var(--streak-warm, #FFB020)',
    size: 20,
    glowColor: 'rgba(255, 176, 32, 0.25)',
    glowSize: 0,
    swaySpeed: 2000,
    amplitude: 3,
    flicker: false,
    flickerSpeed: 0,
    particles: false,
  },
  2: {
    color: 'var(--streak-hot, #FF6B35)',
    size: 24,
    glowColor: 'rgba(255, 107, 53, 0.25)',
    glowSize: 4,
    swaySpeed: 1500,
    amplitude: 4,
    flicker: false,
    flickerSpeed: 0,
    particles: false,
  },
  3: {
    color: 'var(--streak-fire, #FF3D00)',
    size: 28,
    glowColor: 'rgba(255, 61, 0, 0.38)',
    glowSize: 6,
    swaySpeed: 1000,
    amplitude: 5,
    flicker: true,
    flickerSpeed: 500,
    particles: false,
  },
  4: {
    color: 'var(--streak-inferno, #FF1744)',
    size: 32,
    glowColor: 'rgba(255, 23, 68, 0.38)',
    glowSize: 10,
    swaySpeed: 800,
    amplitude: 6,
    flicker: true,
    flickerSpeed: 400,
    particles: false,
  },
  5: {
    color: 'var(--streak-legend, #D500F9)',
    size: 36,
    glowColor: 'rgba(213, 0, 249, 0.38)',
    glowSize: 16,
    swaySpeed: 600,
    amplitude: 8,
    flicker: true,
    flickerSpeed: 300,
    particles: true,
  },
};
