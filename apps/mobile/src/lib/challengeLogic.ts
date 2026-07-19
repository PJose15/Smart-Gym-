/**
 * Pure challenge logic — tab split, progress, score formatting, countdown,
 * leaderboard rows, join eligibility, icons.
 *
 * Mirrors the feedLogic.ts pattern: no Supabase, no React, no side effects.
 * All time-dependent functions accept an injected `now` param for determinism.
 */
import type {
  ChallengeListItem,
  ChallengeParticipant,
  ChallengeDetail,
  ChallengeType,
} from '@nexera/types';
import type { WeightUnit } from '@nexera/types';
import { convertFromLbs } from './feedLogic';

// ─── Icons ───────────────────────────────────────────────────────────────────

const CHALLENGE_ICONS: Record<string, string> = {
  volume: '🏋️',
  sessions: '💪',
  pr: '🏆',
  streak: '🔥',
  machine_explorer: '🗺️',
  team: '🤝',
  custom: '🎯',
};

/** Returns the emoji for a challenge type, defaulting to '🎯' for unknown types. */
export function challengeIcon(type: string): string {
  return CHALLENGE_ICONS[type] ?? '🎯';
}

// ─── Tab split ───────────────────────────────────────────────────────────────

export interface ChallengeStatusSplit {
  /** Active challenges sorted by end_date ascending (soonest ending first). */
  active: ChallengeListItem[];
  /** Completed challenges sorted by end_date descending (most recently ended first). */
  completed: ChallengeListItem[];
}

/**
 * Split a mixed list into active/completed tabs.
 * Active: is_active === true, sorted end_date ascending.
 * Completed: is_active === false, sorted end_date descending.
 */
export function splitByStatus(challenges: ChallengeListItem[]): ChallengeStatusSplit {
  const active = challenges
    .filter((c) => c.is_active === true)
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

  const completed = challenges
    .filter((c) => c.is_active === false)
    .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

  return { active, completed };
}

// ─── Progress ────────────────────────────────────────────────────────────────

/**
 * Compute progress percentage from member score vs top score.
 * Returns 0 when myScore is null, negative, or topScore <= 0.
 * Returns 100 when myScore >= topScore. Clamped to [0, 100].
 *
 * DB reality: no goal_value column; progress = my_score / top_score * 100.
 */
export function progressPct(myScore: number | null, topScore: number): number {
  if (myScore === null || myScore < 0 || topScore <= 0) return 0;
  return Math.min(100, (myScore / topScore) * 100);
}

// ─── Score formatting ─────────────────────────────────────────────────────────

/**
 * Format a challenge score for display in the member's preferred unit.
 *
 * volume / pr: stored in lbs → convert to weightUnit, format as locale-grouped
 *   integer ("12,340 lbs" / "5,597 kg").
 * sessions: "N sessions"
 * streak: "N days"
 * machine_explorer: "N machines"
 * team / custom: plain integer "N"
 */
export function formatScore(
  score: number,
  type: ChallengeType | string,
  unit: WeightUnit,
): string {
  switch (type) {
    case 'volume':
    case 'pr': {
      const converted = convertFromLbs(score, unit);
      const rounded = Math.round(converted);
      return `${rounded.toLocaleString()} ${unit}`;
    }
    case 'sessions':
      return `${Math.round(score)} sessions`;
    case 'streak':
      return `${Math.round(score)} days`;
    case 'machine_explorer':
      return `${Math.round(score)} machines`;
    default:
      // team, custom, unknown
      return `${Math.round(score)}`;
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Human-readable time remaining until a challenge ends.
 * Uses injected `now` for determinism (mirrors computeDaysRemaining convention).
 *
 * future >1d  → "Xd left"
 * <=1d same day → "Ends today"
 * past or exact → "Ended"
 */
export function countdownLabel(endDate: string, now: Date): string {
  const diffMs = new Date(endDate).getTime() - now.getTime();
  if (diffMs <= 0) return 'Ended';
  const daysLeft = diffMs / MS_PER_DAY;
  if (daysLeft <= 1) return 'Ends today';
  return `${Math.floor(daysLeft)}d left`;
}

// ─── Leaderboard rows ─────────────────────────────────────────────────────────

export interface LeaderboardRows {
  /** Top N participants. */
  top: ChallengeParticipant[];
  /**
   * The current member's row when their rank is outside topN.
   * null when the member is inside topN or not a participant.
   */
  pinnedMe: ChallengeParticipant | null;
}

/**
 * Build top-N + optional pinned-me row for the leaderboard.
 *
 * pinnedMe is null when:
 * - my rank is ≤ topN (I'm already visible in the top rows)
 * - I'm not a participant in this challenge
 */
export function buildLeaderboardRows(
  participants: ChallengeParticipant[],
  myMemberId: string,
  topN = 10,
): LeaderboardRows {
  const top = participants.slice(0, topN);
  const isInsideTop = top.some((p) => p.member_id === myMemberId);
  const myRow = participants.find((p) => p.member_id === myMemberId);
  const pinnedMe = !isInsideTop && myRow ? myRow : null;
  return { top, pinnedMe };
}

// ─── Join eligibility ─────────────────────────────────────────────────────────

/**
 * Returns true when a member can join this challenge:
 * - challenge must be active
 * - member must not already be joined
 * - entry_mode must not be 'invite' (invite-only = no self-join)
 */
export function canJoin(detail: Pick<ChallengeDetail, 'is_active' | 'is_joined' | 'entry_mode'>): boolean {
  return detail.is_active && !detail.is_joined && detail.entry_mode !== 'invite';
}
