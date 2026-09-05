/**
 * Client-side localized feed card description builder.
 *
 * Feed events are stored with `display_text` historically baked in lbs and
 * often with a `${member_name} ` prefix (see `lib/feedGenerator.ts`,
 * `lib/social/memberGoals.ts`, `lib/social/workoutShare.ts`). The UI
 * templates (`FeedEventCard`, `CommunityPulse`) render a bold member name
 * span before the description, so producers should NOT include the name.
 *
 * This helper:
 *   1. Rebuilds the description from `context_data` in the viewer's
 *      preferred weight unit when possible (pr_weight, pr_volume,
 *      goal_reached, workout_share).
 *   2. Always returns a string WITHOUT a leading `${member_name} ` so the
 *      UI span provides the single bold name.
 *   3. Strips a legacy leading name prefix from `event.description` when
 *      falling back, so old rows render correctly too.
 *
 * Storage is unchanged — this is purely a rendering concern.
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
 * Strip a leading `${name} ` prefix from `description` if present. Handles
 * legacy stored records that baked the member name into display_text.
 * No-op when the description does not start with the name.
 */
function stripNamePrefix(description: string, name: string | null | undefined): string {
  if (!name) return description;
  const prefix = `${name} `;
  return description.startsWith(prefix) ? description.slice(prefix.length) : description;
}

/**
 * Rebuild a feed event's description in the viewer's preferred weight unit.
 * Returned strings never include the member name prefix — the UI renders
 * the bold name span separately.
 *
 *   formatFeedEvent(prEvent, 'kg') // "hit a new personal best — 102 kg!"
 */
export function formatFeedEvent(event: FeedEventLike, unit: WeightUnit): string {
  const ctx = (event.context_data ?? {}) as Record<string, unknown>;
  const fallback = () => stripNamePrefix(event.description, event.member_name);

  const machinePart = () => {
    const machineName = typeof ctx.machine_name === 'string' ? ctx.machine_name : null;
    return machineName ? ` on ${machineName}` : '';
  };

  switch (event.event_type) {
    case 'pr_weight': {
      const lbs = numberOrNull(ctx.best_weight_lbs);
      if (lbs == null) return fallback();
      return `hit a new personal best${machinePart()} — ${formatWeight(lbs, unit)}!`;
    }

    case 'pr_volume': {
      const lbs = numberOrNull(ctx.volume_lbs);
      if (lbs == null) return fallback();
      return `hit a volume PR${machinePart()} — ${formatVolume(lbs, unit)}!`;
    }

    case 'goal_reached': {
      const target = numberOrNull(ctx.target_weight);
      if (target == null) return fallback();
      return `hit their goal${machinePart()} — ${formatWeight(target, unit)}!`;
    }

    case 'workout_share': {
      // Only 'completed' share posts embed a volume number in display_text.
      const status = typeof ctx.share_status === 'string' ? ctx.share_status : null;
      if (status !== 'completed') return fallback();
      const volume = numberOrNull(ctx.volume_lbs);
      const prs = numberOrNull(ctx.prs_hit);
      const parts: string[] = [];
      if (volume != null && volume > 0) parts.push(formatVolume(volume, unit));
      if (prs != null && prs > 0) parts.push(`${prs} PR${prs > 1 ? 's' : ''}`);
      if (parts.length === 0) return fallback();
      return `finished training — ${parts.join(', ')}`;
    }

    default:
      return fallback();
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
