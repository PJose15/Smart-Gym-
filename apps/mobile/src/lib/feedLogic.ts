/**
 * Pure feed logic — formatting, filtering, optimistic reaction state.
 *
 * Mirrors the web contract in `apps/web-admin/src/lib/feed/formatFeedEvent.ts`:
 * feed events are stored with `display_text` baked in lbs and historically
 * with a `${member_name} ` prefix. The UI renders a bold member-name span
 * separately, so descriptions returned here NEVER include the name prefix.
 * Numeric event types (pr_weight, goal_reached, workout_share) are rebuilt
 * from `context_data` in the viewer's preferred weight unit.
 *
 * All functions are pure (no React, no Supabase) so they run under the
 * node ts-jest test environment.
 */
import type {
  FeedEventFull,
  FeedReactionCounts,
  ReactionType,
  WeightUnit,
  WorkoutShareContext,
} from '@nexera/types';

// ─── Weight helpers (DB stores lbs — mirror web-admin/src/lib/weight.ts) ───

/** 1 lb = 0.45359237 kg (exact by international agreement, 1959). */
const KG_PER_LB = 0.45359237;

/** Convert lbs → target unit. Returns a raw number (not formatted). */
export function convertFromLbs(lbs: number, unit: WeightUnit): number {
  return unit === 'kg' ? lbs * KG_PER_LB : lbs;
}

/**
 * Format a stored-lbs weight for display in the viewer's unit.
 * lbs: integer. kg: 1 decimal when < 10, integer when ≥ 10.
 */
export function formatWeightLbs(lbs: number, unit: WeightUnit): string {
  const value = convertFromLbs(lbs, unit);
  const rounded =
    unit === 'kg' && value < 10
      ? value.toFixed(1)
      : Math.round(value).toLocaleString();
  return `${rounded} ${unit}`;
}

/** Format a stored-lbs volume with `k` suffix at scale. */
export function formatVolumeLbs(lbs: number, unit: WeightUnit): string {
  const value = convertFromLbs(lbs, unit);
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ${unit}`;
  }
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

/** Convert kg → stored lbs (feed contract stores lbs). Rounded to integer. */
export function lbsFromKg(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}

// ─── Workout share builder (web `lib/social/workoutShare.ts` contract) ──────

export interface WorkoutShareInput {
  /** Session volume in kg (mobile stores kg; the feed contract stores lbs). */
  volumeKg: number;
  /** Number of PRs hit this session. */
  prsHit: number;
  /** Machine / exercise names used this session. */
  machinesUsed: string[];
  /** ISO timestamp of completion (defaults to now). */
  completedAt?: string;
}

export interface WorkoutShare {
  display_text: string;
  context_data: WorkoutShareContext;
}

/**
 * Build the `display_text` + `context_data` for a completed workout share,
 * byte-matching web-admin's `updateWorkoutSharePost` output so web renders
 * mobile shares identically:
 *   - display_text: `finished training — ${volume.toLocaleString()} lbs, ${n} PR(s)`
 *     (no member-name prefix — the card renders the bold name span)
 *   - context_data: full WorkoutShareContext with share_status 'completed'
 *     and volume stored in lbs.
 *
 * 'en-US' locale is pinned so the stored text matches the web producer
 * regardless of device locale.
 */
export function buildWorkoutShare(input: WorkoutShareInput): WorkoutShare {
  const volumeLbs = Math.max(lbsFromKg(input.volumeKg), 0);
  const prsHit = Math.max(Math.round(input.prsHit), 0);

  const parts: string[] = [];
  if (volumeLbs > 0) parts.push(`${volumeLbs.toLocaleString('en-US')} lbs`);
  if (prsHit > 0) parts.push(`${prsHit} PR${prsHit > 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';

  return {
    display_text: `finished training${suffix}`,
    context_data: {
      share_status: 'completed',
      program_week: null,
      program_day: null,
      program_focus: null,
      sessions_completed_today: 1,
      prs_hit: prsHit,
      volume_lbs: volumeLbs,
      machines_used: input.machinesUsed,
      completed_at: input.completedAt ?? new Date().toISOString(),
    },
  };
}

/**
 * UTC calendar date (YYYY-MM-DD) for `workout_share_log.shared_at`.
 * Matches web's `new Date().toISOString().split('T')[0]` — the
 * UNIQUE(member_id, shared_at) one-share-per-day key.
 */
export function shareDateUtc(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

// ─── Description formatting (web `formatFeedEvent` contract) ────────────────

type FeedEventLike = Pick<FeedEventFull, 'event_type' | 'description' | 'member_name'> & {
  context_data?: Record<string, unknown> | null;
};

function numberOrNull(v: unknown): number | null {
  if (typeof v !== 'number') return null;
  return Number.isFinite(v) ? v : null;
}

/**
 * Strip a leading `${name} ` prefix from `description` if present. Handles
 * legacy stored records that baked the member name into display_text.
 */
export function stripNamePrefix(description: string, name: string | null | undefined): string {
  if (!name) return description;
  const prefix = `${name} `;
  return description.startsWith(prefix) ? description.slice(prefix.length) : description;
}

/**
 * Build a feed event's display description in the viewer's weight unit.
 * Never includes the member-name prefix — the card renders the bold name.
 */
export function formatFeedEventText(event: FeedEventLike, unit: WeightUnit): string {
  const ctx = (event.context_data ?? {}) as Record<string, unknown>;
  const fallback = () => stripNamePrefix(event.description, event.member_name);

  switch (event.event_type) {
    case 'pr_weight': {
      const lbs = numberOrNull(ctx.best_weight_lbs);
      if (lbs == null) return fallback();
      return `hit a new personal best — ${formatWeightLbs(lbs, unit)}!`;
    }

    case 'goal_reached': {
      const target = numberOrNull(ctx.target_weight);
      if (target == null) return fallback();
      const machineName = typeof ctx.machine_name === 'string' ? ctx.machine_name : null;
      const machinePart = machineName ? ` on ${machineName}` : '';
      return `hit their goal${machinePart} — ${formatWeightLbs(target, unit)}!`;
    }

    case 'workout_share': {
      const status = typeof ctx.share_status === 'string' ? ctx.share_status : null;
      if (status !== 'completed') return fallback();
      const volume = numberOrNull(ctx.volume_lbs);
      const prs = numberOrNull(ctx.prs_hit);
      const parts: string[] = [];
      if (volume != null && volume > 0) parts.push(formatVolumeLbs(volume, unit));
      if (prs != null && prs > 0) parts.push(`${prs} PR${prs > 1 ? 's' : ''}`);
      if (parts.length === 0) return fallback();
      return `finished training — ${parts.join(', ')}`;
    }

    default:
      return fallback();
  }
}

// ─── Event icons (mirrors web FeedEventCard EVENT_ICONS) ────────────────────

export const EVENT_ICONS: Record<string, string> = {
  achievement_earned: '🏅',
  level_up: '⭐',
  pr_weight: '🏆',
  pr_volume: '🏆',
  session_milestone: '💪',
  streak_milestone: '🔥',
  program_complete: '✅',
  challenge_launched: '🎯',
  challenge_joined: '🎯',
  challenge_rank_1: '🥇',
  challenge_podium: '🏅',
  challenge_complete: '🏁',
  new_member: '👋',
  gym_announcement: '📢',
  member_spotlight: '✨',
  goal_reached: '🌟',
  archetype_change: '🧬',
  workout_share: '🏋️',
};

export const DEFAULT_EVENT_ICON = '📢';

export function eventIcon(eventType: string): string {
  return EVENT_ICONS[eventType] || DEFAULT_EVENT_ICON;
}

// ─── Relative timestamps (mirrors web timeAgo) ──────────────────────────────

export function timeAgo(dateStr: string, nowMs: number = Date.now()): string {
  const diff = nowMs - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Reaction toggle (optimistic update + rollback) ─────────────────────────

/**
 * Toggle a reaction type on an event, returning a NEW event object.
 * The DB allows one row per (event, member, type) — members may hold
 * multiple different reaction types at once (web parity).
 *
 * Applying the same toggle twice returns the original state, so the
 * rollback after a failed network call is simply `applyReactionToggle`
 * with the same arguments.
 */
export function applyReactionToggle(event: FeedEventFull, type: ReactionType): FeedEventFull {
  const wasActive = event.my_reactions.includes(type);
  const reactions: FeedReactionCounts = {
    ...event.reactions,
    [type]: Math.max(event.reactions[type] + (wasActive ? -1 : 1), 0),
  };
  const my_reactions = wasActive
    ? event.my_reactions.filter((t) => t !== type)
    : [...event.my_reactions, type];
  const reaction_count =
    reactions.strength + reactions.fire + reactions.champion + reactions.letsgo;

  return { ...event, reactions, my_reactions, reaction_count };
}

/** Toggle a reaction on one event within a list (immutably). */
export function toggleReactionInList(
  events: FeedEventFull[],
  eventId: string,
  type: ReactionType,
): FeedEventFull[] {
  return events.map((e) => (e.id === eventId ? applyReactionToggle(e, type) : e));
}

// ─── Pagination merge / dedupe ──────────────────────────────────────────────

/**
 * Merge feed pages, deduplicating by id. Existing events keep their position;
 * incoming events are appended (older page) or prepended (realtime).
 *
 * 'prepend' inserts fresh events AFTER the leading pinned block, so pinned
 * events keep the very top of the feed.
 */
export function mergeFeedEvents(
  existing: FeedEventFull[],
  incoming: FeedEventFull[],
  position: 'append' | 'prepend' = 'append',
): FeedEventFull[] {
  const seen = new Set(existing.map((e) => e.id));
  const fresh = incoming.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  if (position === 'append') return [...existing, ...fresh];

  // Prepend: partition by is_pinned — fresh events go right after the pinned block.
  const pinned = existing.filter((e) => e.is_pinned);
  const unpinned = existing.filter((e) => !e.is_pinned);
  return [...pinned, ...fresh, ...unpinned];
}

// ─── Filters (DOC_05 §4 — 5 chips, mapped to REAL schema event types) ───────

export type FeedFilter = 'all' | 'prs' | 'achievements' | 'streaks' | 'challenges';

export const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prs', label: 'PRs' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'challenges', label: 'Challenges' },
];

const FILTER_TYPE_MAP: Record<Exclude<FeedFilter, 'all'>, string[]> = {
  prs: ['pr_weight', 'pr_volume', 'goal_reached'],
  achievements: ['achievement_earned', 'level_up', 'archetype_change'],
  streaks: ['streak_milestone', 'session_milestone'],
  challenges: [
    'challenge_launched',
    'challenge_joined',
    'challenge_rank_1',
    'challenge_podium',
    'challenge_complete',
  ],
};

export function filterFeedEvents(events: FeedEventFull[], filter: FeedFilter): FeedEventFull[] {
  if (filter === 'all') return events;
  const types = FILTER_TYPE_MAP[filter];
  return events.filter((e) => types.includes(e.event_type));
}
