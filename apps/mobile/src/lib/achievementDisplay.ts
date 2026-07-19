/**
 * Achievement display constants + pure helpers â€” DOC_03 Section 9.
 * Rarity border/glow colors, display XP, difficulty, and locked-badge
 * progress derivation from criteria_type.
 */
import { colors } from '../theme/colors';
import type { BadgeCriteriaType, BadgeRarity } from '@nexera/types';

/** Rarity border colors per DOC_03 Section 9. */
export const RARITY_BORDER_COLORS: Record<BadgeRarity, string> = {
  common: colors.streakCold,   // #606070 gray
  rare: colors.info,           // #3B82F6 blue
  epic: colors.primary,        // crimson
  legendary: colors.gold,      // #FFD700 gold
};

/** Rarity glow (shadow) colors per DOC_03 Section 9 intensities. */
export const RARITY_GLOW_COLORS: Record<BadgeRarity, string> = {
  common: 'rgba(96, 96, 112, 0.3)',
  rare: 'rgba(59, 130, 246, 0.4)',
  epic: 'rgba(124, 92, 255, 0.5)',
  legendary: 'rgba(255, 215, 0, 0.6)',
};

export const RARITY_GLOW_RADIUS: Record<BadgeRarity, number> = {
  common: 16,
  rare: 24,
  epic: 32,
  legendary: 48,
};

/**
 * Display XP per rarity. Badges have no stored points value â€” this is the
 * celebration-display convention (kept aligned with pointsService scale).
 */
export const RARITY_XP: Record<BadgeRarity, number> = {
  common: 50,
  rare: 100,
  epic: 250,
  legendary: 500,
};

export const RARITY_DIFFICULTY: Record<BadgeRarity, string> = {
  common: 'Easy',
  rare: 'Moderate',
  epic: 'Hard',
  legendary: 'Extreme',
};

/** Stats a caller may have on hand for progress derivation. */
export interface BadgeProgressStats {
  completedWorkouts?: number;
  longestStreak?: number;
  totalVolumeKg?: number;
  totalPRs?: number;
  totalPoints?: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
  /** 0â€“1, clamped */
  ratio: number;
  label: string;
}

const CRITERIA_STAT: Record<BadgeCriteriaType, { stat: keyof BadgeProgressStats; unit: string }> = {
  first_workout: { stat: 'completedWorkouts', unit: 'workout' },
  workouts_10: { stat: 'completedWorkouts', unit: 'workout' },
  workouts_50: { stat: 'completedWorkouts', unit: 'workout' },
  workouts_100: { stat: 'completedWorkouts', unit: 'workout' },
  streak_4: { stat: 'longestStreak', unit: 'week' },
  streak_12: { stat: 'longestStreak', unit: 'week' },
  total_volume_10k: { stat: 'totalVolumeKg', unit: 'kg' },
  total_volume_100k: { stat: 'totalVolumeKg', unit: 'kg' },
  prs_5: { stat: 'totalPRs', unit: 'PR' },
  prs_25: { stat: 'totalPRs', unit: 'PR' },
  points_500: { stat: 'totalPoints', unit: 'point' },
  points_5000: { stat: 'totalPoints', unit: 'point' },
};

function pluralize(n: number, unit: string): string {
  if (unit === 'kg') return 'kg';
  return n === 1 ? unit : `${unit}s`;
}

/**
 * Derives progress toward a locked badge from whatever stats are available.
 * Returns null when the required stat is unknown â€” callers should omit the
 * progress bar in that case.
 */
export function getBadgeProgress(
  criteriaType: BadgeCriteriaType,
  criteriaValue: number,
  stats: BadgeProgressStats,
): BadgeProgress | null {
  const mapping = CRITERIA_STAT[criteriaType];
  if (!mapping || !Number.isFinite(criteriaValue) || criteriaValue <= 0) return null;

  const raw = stats[mapping.stat];
  if (raw === undefined || raw === null || !Number.isFinite(raw)) return null;

  const current = Math.max(0, Math.min(raw, criteriaValue));
  const remaining = Math.max(0, criteriaValue - current);
  const ratio = Math.min(1, current / criteriaValue);

  const label = remaining === 0
    ? 'Ready to unlock â€” finish your next workout!'
    : `${current.toLocaleString()}/${criteriaValue.toLocaleString()} ${pluralize(criteriaValue, mapping.unit)} â€” ${remaining.toLocaleString()} to go`;

  return { current, target: criteriaValue, ratio, label };
}
