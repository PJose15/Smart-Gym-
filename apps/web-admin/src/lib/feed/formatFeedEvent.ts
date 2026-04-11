/**
 * Client-side localized feed card description builder.
 *
 * Feed events are stored with `display_text` baked in lbs (see
 * `lib/feedGenerator.ts`, `lib/social/memberGoals.ts`, `lib/social/workoutShare.ts`).
 * This helper rebuilds the description from `context_data` at render time so
 * members whose `weight_unit` preference is `kg` see converted values.
 *
 * For event types that don't embed numeric weight/volume, we return
 * `event.description` unchanged (server-baked string is the fallback).
 *
 * Storage is unchanged — this is purely a rendering concern.
 *
 * Output shape mirrors the server-baked `display_text`: includes the member
 * name prefix for consistency with the fall-through `event.description`
 * string, so call sites don't need special-casing.
 */

import type { FeedEventFull, FeedEventData } from '@nexera/types';
import { formatWeight, formatVolume, type WeightUnit } from '@/lib/weight';

type FeedEventLike = Pick<FeedEventFull, 'event_type' | 'description' | 'member_name'> & {
  context_data?: Record<string, unknown> | null;
};

/** Coerce an unknown value into a finite number, or null. */
function numberOrNull(v: unknown): number | null {
  if (typeof v !== 'number') return null;
  return Number.isFinite(v) ? v : null;
}

/**
 * Rebuild a feed event's description in the viewer's preferred weight unit.
 * Falls back to `event.description` for any event without a numeric context
 * field or when context data is missing / malformed.
 *
 *   formatFeedEvent(prEvent, 'kg') // "Alice hit a new personal best — 102 kg!"
 *   formatFeedEvent(streakEvent, 'kg') // (no change — integer field)
 */
export function formatFeedEvent(event: FeedEventLike, unit: WeightUnit): string {
  const ctx = (event.context_data ?? {}) as Record<string, unknown>;
  const name = event.member_name || 'Member';

  switch (event.event_type) {
    case 'pr_weight': {
      const lbs = numberOrNull(ctx.best_weight_lbs);
      if (lbs == null) return event.description;
      return `${name} hit a new personal best — ${formatWeight(lbs, unit)}!`;
    }

    case 'goal_reached': {
      const target = numberOrNull(ctx.target_weight);
      if (target == null) return event.description;
      const machineName = typeof ctx.machine_name === 'string' ? ctx.machine_name : null;
      const machinePart = machineName ? ` on ${machineName}` : '';
      return `${name} hit their goal${machinePart} — ${formatWeight(target, unit)}!`;
    }

    case 'workout_share': {
      // Only 'completed' share posts embed a volume number in display_text.
      const status = typeof ctx.share_status === 'string' ? ctx.share_status : null;
      if (status !== 'completed') return event.description;
      const volume = numberOrNull(ctx.volume_lbs);
      const prs = numberOrNull(ctx.prs_hit);
      const parts: string[] = [];
      if (volume != null && volume > 0) parts.push(formatVolume(volume, unit));
      if (prs != null && prs > 0) parts.push(`${prs} PR${prs > 1 ? 's' : ''}`);
      if (parts.length === 0) return event.description;
      return `${name} finished training — ${parts.join(', ')}`;
    }

    default:
      return event.description;
  }
}

/**
 * Variant for `FeedEventData` (home-screen community pulse) which carries
 * `context_data` through the home API response.
 */
export function formatFeedEventData(
  event: FeedEventData & { context_data?: Record<string, unknown> | null },
  unit: WeightUnit
): string {
  return formatFeedEvent(event, unit);
}
