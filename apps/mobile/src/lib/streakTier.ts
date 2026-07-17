/**
 * Streak flame tier logic — pure, testable. DOC_03 Section 8.
 *
 * | Tier | Days   | Feel     |
 * |------|--------|----------|
 * | 0    | 0      | Cold     |
 * | 1    | 1–6    | Warm     |
 * | 2    | 7–20   | Hot      |
 * | 3    | 21–49  | Fire     |
 * | 4    | 50–99  | Inferno  |
 * | 5    | 100+   | Legend   |
 */
import { colors } from '../theme/colors';

export type StreakTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface StreakTierConfig {
  name: string;
  color: string;
  /** Flame width in px (height is size * 1.3) */
  size: number;
  /** Glow shadow color (transparent on tier 0) */
  glowColor: string;
  /** Full sway cycle duration in ms (0 = no animation) */
  speed: number;
  /** Sway amplitude in degrees */
  amplitude: number;
  /** Scale-pulse flicker (tiers 3–5 per spec) */
  flicker: boolean;
}

/** Tier from a streak measured in days. */
export function getStreakTier(streakDays: number): StreakTier {
  if (Number.isNaN(streakDays) || streakDays <= 0) return 0;
  if (streakDays < 7) return 1;
  if (streakDays < 21) return 2;
  if (streakDays < 50) return 3;
  if (streakDays < 100) return 4;
  return 5;
}

/** Tier from a streak measured in weeks (Nexera streakService unit). */
export function getStreakTierFromWeeks(streakWeeks: number): StreakTier {
  return getStreakTier(streakWeeks * 7);
}

export const STREAK_TIER_CONFIG: Record<StreakTier, StreakTierConfig> = {
  0: { name: 'Cold',    color: colors.streakCold,    size: 16, glowColor: 'transparent',              speed: 0,    amplitude: 0, flicker: false },
  1: { name: 'Warm',    color: colors.streakWarm,    size: 20, glowColor: `${colors.streakWarm}40`,    speed: 2000, amplitude: 3, flicker: false },
  2: { name: 'Hot',     color: colors.streakHot,     size: 24, glowColor: `${colors.streakHot}40`,     speed: 1500, amplitude: 4, flicker: false },
  3: { name: 'Fire',    color: colors.streakFire,    size: 28, glowColor: `${colors.streakFire}60`,    speed: 1000, amplitude: 5, flicker: true },
  4: { name: 'Inferno', color: colors.streakInferno, size: 32, glowColor: `${colors.streakInferno}60`, speed: 800,  amplitude: 6, flicker: true },
  5: { name: 'Legend',  color: colors.streakLegend,  size: 36, glowColor: `${colors.streakLegend}60`,  speed: 600,  amplitude: 8, flicker: true },
};
