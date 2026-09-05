/**
 * Achievement display constants + pure helpers over the real
 * `achievement_definitions` model (code / category / points /
 * required_value / required_unit).
 *
 * - Emoji: category defaults + per-code overrides.
 * - Points tier: bronze <200 / silver 200–499 / gold ≥500 — replaces the
 *   old rarity system, honest to the seeded points range (50–3000).
 * - Progress: derived from `required_value` + `required_unit` against
 *   whatever stats the caller has on hand.
 */
import { colors } from '../theme/colors';
import type { AchievementCategory, BadgeWithStatus } from './badgeService';

// ─── Emoji ──────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<AchievementCategory, string> = {
  milestone: '🏆',
  performance: '💪',
  consistency: '🔥',
  explorer: '🧭',
  community: '🤝',
};

/** Per-code overrides for badges with a stronger visual identity. */
const CODE_EMOJI: Record<string, string> = {
  'first-scan': '🎯',
  'first-pr': '⭐',
  'volume-10k': '🏋️',
  'volume-100k': '🏋️',
  'volume-1m': '🏋️',
  'level-10': '👑',
  'sessions-500': '👑',
  'challenge-win': '🥇',
  'challenge-podium': '🥉',
  spotlight: '🌟',
  'machines-all': '🗺️',
};

/** Emoji for a badge: code override → category default → trophy. */
export function getBadgeEmoji(badge: BadgeWithStatus): string {
  return CODE_EMOJI[badge.code] ?? CATEGORY_EMOJI[badge.category] ?? '🏆';
}

// ─── Points tier (replaces rarity) ──────────────────────────

export type PointsTier = 'bronze' | 'silver' | 'gold';

/** Tier from stored points: bronze <200, silver 200–499, gold ≥500. */
export function getPointsTier(points: number): PointsTier {
  if (points >= 500) return 'gold';
  if (points >= 200) return 'silver';
  return 'bronze';
}

export const POINTS_TIER_LABELS: Record<PointsTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

/** Border / accent color per tier (metallic tokens). */
export const POINTS_TIER_COLORS: Record<PointsTier, string> = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.gold,
};

/** Subtle background fill per tier. */
export const POINTS_TIER_SUBTLE_COLORS: Record<PointsTier, string> = {
  bronze: 'rgba(205, 127, 50, 0.08)',
  silver: 'rgba(192, 192, 192, 0.08)',
  gold: colors.goldSubtle,
};

/** Glow (shadow) color per tier. */
export const POINTS_TIER_GLOW_COLORS: Record<PointsTier, string> = {
  bronze: 'rgba(205, 127, 50, 0.30)',
  silver: 'rgba(192, 192, 192, 0.35)',
  gold: 'rgba(232, 179, 57, 0.55)',
};

/** Glow radius per tier (celebration takeover). */
export const POINTS_TIER_GLOW_RADIUS: Record<PointsTier, number> = {
  bronze: 16,
  silver: 24,
  gold: 40,
};

// ─── Progress derivation ────────────────────────────────────

/**
 * Stats a caller may have on hand, keyed by `required_unit` values used in
 * the achievement seeds. All optional — unknown units just hide progress.
 */
export interface BadgeProgressStats {
  /** Completed workout sessions */
  sessions?: number;
  /** Total volume lifted, in lbs */
  lbs?: number;
  /** Longest training streak, in days */
  days?: number;
  /** Personal records set */
  prs?: number;
  /** Current member level */
  level?: number;
  /** Distinct machines used */
  machines?: number;
  /** Training programs completed */
  programs?: number;
  /** Gym challenges joined */
  challenges?: number;
  /** Challenges won */
  wins?: number;
  /** Top-3 challenge finishes */
  podiums?: number;
  /** Member spotlight features */
  spotlights?: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
  /** 0–1, clamped */
  ratio: number;
  label: string;
}

/** Display noun per unit; `invariant: true` means no pluralization. */
const UNIT_DISPLAY: Record<keyof BadgeProgressStats, { noun: string; invariant?: boolean }> = {
  sessions: { noun: 'session' },
  lbs: { noun: 'lbs', invariant: true },
  days: { noun: 'day' },
  prs: { noun: 'PR' },
  level: { noun: 'level', invariant: true },
  machines: { noun: 'machine' },
  programs: { noun: 'program' },
  challenges: { noun: 'challenge' },
  wins: { noun: 'win' },
  podiums: { noun: 'podium finish', invariant: false },
  spotlights: { noun: 'spotlight' },
};

function pluralize(n: number, unit: { noun: string; invariant?: boolean }): string {
  if (unit.invariant) return unit.noun;
  return n === 1 ? unit.noun : `${unit.noun}s`;
}

/**
 * Derives progress toward a locked badge from whatever stats are available.
 * Returns null when the stat is unknown or the badge has no usable
 * `required_value`/`required_unit` — callers should omit the progress bar
 * in that case.
 */
export function getBadgeProgress(
  badge: Pick<BadgeWithStatus, 'required_value' | 'required_unit'>,
  stats: BadgeProgressStats,
): BadgeProgress | null {
  const target = badge.required_value;
  if (target == null || !Number.isFinite(target) || target <= 0) return null;

  const unitKey = badge.required_unit as keyof BadgeProgressStats | null;
  if (!unitKey || !(unitKey in UNIT_DISPLAY)) return null;

  const raw = stats[unitKey];
  if (raw === undefined || raw === null || !Number.isFinite(raw)) return null;

  const current = Math.max(0, Math.min(raw, target));
  const remaining = Math.max(0, target - current);
  const ratio = Math.min(1, current / target);

  const label = remaining === 0
    ? 'Ready to unlock — finish your next workout!'
    : `${current.toLocaleString()}/${target.toLocaleString()} ${pluralize(target, UNIT_DISPLAY[unitKey])} — ${remaining.toLocaleString()} to go`;

  return { current, target, ratio, label };
}
