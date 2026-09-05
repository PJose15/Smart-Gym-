/**
 * Tests for pure feed logic — formatting, reaction toggling, page merging,
 * filtering. Mirrors the web formatFeedEvent contract (no name prefix,
 * weight-unit rebuild from context_data).
 */
import type { FeedEventFull } from '@nexera/types';
import {
  applyReactionToggle,
  buildWorkoutShare,
  convertFromLbs,
  eventIcon,
  filterFeedEvents,
  formatFeedEventText,
  formatVolumeLbs,
  formatWeightLbs,
  lbsFromKg,
  mergeFeedEvents,
  shareDateUtc,
  stripNamePrefix,
  timeAgo,
  toggleReactionInList,
} from '../feedLogic';

function makeEvent(overrides: Partial<FeedEventFull> = {}): FeedEventFull {
  return {
    id: 'evt-1',
    event_type: 'pr_weight',
    member_name: 'Alice Johnson',
    description: 'hit a new personal best — 225 lbs!',
    created_at: '2026-07-01T12:00:00.000Z',
    reaction_count: 0,
    member_id: 'mem-1',
    avatar_url: null,
    context_data: {},
    priority: 'medium',
    is_pinned: false,
    comment_count: 0,
    reactions: { strength: 0, fire: 0, champion: 0, letsgo: 0 },
    my_reactions: [],
    ...overrides,
  };
}

// ─── Weight helpers ─────────────────────────────────────────────────────────

describe('weight helpers', () => {
  it('converts lbs to kg with the exact factor', () => {
    expect(convertFromLbs(225, 'kg')).toBeCloseTo(102.058, 2);
    expect(convertFromLbs(225, 'lbs')).toBe(225);
  });

  it('formats lbs as integers', () => {
    expect(formatWeightLbs(225, 'lbs')).toBe('225 lbs');
    expect(formatWeightLbs(225.4, 'lbs')).toBe('225 lbs');
  });

  it('formats kg with 1 decimal under 10, integer at 10+', () => {
    expect(formatWeightLbs(225, 'kg')).toBe('102 kg');
    expect(formatWeightLbs(15, 'kg')).toBe('6.8 kg');
  });

  it('formats volume with k suffix at scale', () => {
    expect(formatVolumeLbs(125_000, 'lbs')).toBe('125.0k lbs');
    expect(formatVolumeLbs(125_000, 'kg')).toBe('56.7k kg');
    expect(formatVolumeLbs(850, 'lbs')).toBe('850 lbs');
  });
});

// ─── Description formatting ─────────────────────────────────────────────────

describe('formatFeedEventText', () => {
  it('rebuilds pr_weight from context_data in kg', () => {
    const event = makeEvent({ context_data: { best_weight_lbs: 225 } });
    expect(formatFeedEventText(event, 'kg')).toBe('hit a new personal best — 102 kg!');
  });

  it('rebuilds pr_weight in lbs', () => {
    const event = makeEvent({ context_data: { best_weight_lbs: 225 } });
    expect(formatFeedEventText(event, 'lbs')).toBe('hit a new personal best — 225 lbs!');
  });

  it('falls back to stored description when context is missing', () => {
    const event = makeEvent({ context_data: {} });
    expect(formatFeedEventText(event, 'kg')).toBe('hit a new personal best — 225 lbs!');
  });

  it('includes machine_name in pr_weight when present (pr-check enriched context)', () => {
    const event = makeEvent({
      context_data: { best_weight_lbs: 225, machine_name: 'Chest Press', pr_type: 'weight' },
    });
    expect(formatFeedEventText(event, 'lbs')).toBe(
      'hit a new personal best on Chest Press — 225 lbs!',
    );
  });

  it('rebuilds pr_volume from context_data with machine name', () => {
    const event = makeEvent({
      event_type: 'pr_volume',
      context_data: { volume_lbs: 12_500, machine_name: 'Leg Press', pr_type: 'volume' },
    });
    expect(formatFeedEventText(event, 'lbs')).toBe('hit a volume PR on Leg Press — 12.5k lbs!');
    expect(formatFeedEventText(event, 'kg')).toBe('hit a volume PR on Leg Press — 5.7k kg!');
  });

  it('falls back for pr_volume when volume_lbs missing', () => {
    const event = makeEvent({
      event_type: 'pr_volume',
      description: 'New volume PR!',
      context_data: { pr_type: 'volume' },
    });
    expect(formatFeedEventText(event, 'kg')).toBe('New volume PR!');
  });

  it('strips a legacy baked-in name prefix on fallback', () => {
    const event = makeEvent({
      context_data: {},
      description: 'Alice Johnson hit a new personal best — 225 lbs!',
    });
    expect(formatFeedEventText(event, 'kg')).toBe('hit a new personal best — 225 lbs!');
  });

  it('rebuilds goal_reached with machine name', () => {
    const event = makeEvent({
      event_type: 'goal_reached',
      context_data: { target_weight: 200, machine_name: 'Chest Press' },
    });
    expect(formatFeedEventText(event, 'lbs')).toBe('hit their goal on Chest Press — 200 lbs!');
    expect(formatFeedEventText(event, 'kg')).toBe('hit their goal on Chest Press — 91 kg!');
  });

  it('rebuilds completed workout_share with volume and PRs', () => {
    const event = makeEvent({
      event_type: 'workout_share',
      context_data: { share_status: 'completed', volume_lbs: 12_500, prs_hit: 2 },
    });
    expect(formatFeedEventText(event, 'lbs')).toBe('finished training — 12.5k lbs, 2 PRs');
  });

  it('falls back for non-completed workout_share', () => {
    const event = makeEvent({
      event_type: 'workout_share',
      description: 'is crushing it right now',
      context_data: { share_status: 'started' },
    });
    expect(formatFeedEventText(event, 'kg')).toBe('is crushing it right now');
  });

  it('passes through unknown event types unchanged (minus name prefix)', () => {
    const event = makeEvent({
      event_type: 'streak_milestone',
      description: 'Alice Johnson is on a 7-week streak!',
    });
    expect(formatFeedEventText(event, 'kg')).toBe('is on a 7-week streak!');
  });

  it('ignores non-finite numeric context values', () => {
    const event = makeEvent({ context_data: { best_weight_lbs: NaN } });
    expect(formatFeedEventText(event, 'kg')).toBe('hit a new personal best — 225 lbs!');
  });
});

describe('stripNamePrefix', () => {
  it('is a no-op when description does not start with the name', () => {
    expect(stripNamePrefix('unlocked a badge', 'Alice')).toBe('unlocked a badge');
  });

  it('handles null names', () => {
    expect(stripNamePrefix('Alice did a thing', null)).toBe('Alice did a thing');
  });
});

// ─── Icons + timestamps ─────────────────────────────────────────────────────

describe('eventIcon', () => {
  it('maps known types and falls back for unknown ones', () => {
    expect(eventIcon('streak_milestone')).toBe('🔥');
    expect(eventIcon('workout_share')).toBe('🏋️');
    expect(eventIcon('mystery_type')).toBe('📢');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-07-01T12:00:00.000Z').getTime();

  it('renders just now / minutes / hours / days', () => {
    expect(timeAgo('2026-07-01T11:59:40.000Z', now)).toBe('just now');
    expect(timeAgo('2026-07-01T11:45:00.000Z', now)).toBe('15m ago');
    expect(timeAgo('2026-07-01T09:00:00.000Z', now)).toBe('3h ago');
    expect(timeAgo('2026-06-28T12:00:00.000Z', now)).toBe('3d ago');
  });
});

// ─── Reaction toggling ──────────────────────────────────────────────────────

describe('applyReactionToggle', () => {
  it('adds a reaction when not active', () => {
    const event = makeEvent({ reactions: { strength: 2, fire: 0, champion: 0, letsgo: 0 }, reaction_count: 2 });
    const next = applyReactionToggle(event, 'fire');
    expect(next.reactions.fire).toBe(1);
    expect(next.my_reactions).toEqual(['fire']);
    expect(next.reaction_count).toBe(3);
  });

  it('removes a reaction when already active', () => {
    const event = makeEvent({
      reactions: { strength: 2, fire: 1, champion: 0, letsgo: 0 },
      my_reactions: ['fire'],
      reaction_count: 3,
    });
    const next = applyReactionToggle(event, 'fire');
    expect(next.reactions.fire).toBe(0);
    expect(next.my_reactions).toEqual([]);
    expect(next.reaction_count).toBe(2);
  });

  it('supports multiple simultaneous reaction types (web parity)', () => {
    const event = makeEvent({ my_reactions: ['strength'] });
    const next = applyReactionToggle(event, 'letsgo');
    expect(next.my_reactions).toEqual(['strength', 'letsgo']);
  });

  it('is its own inverse (rollback = re-apply)', () => {
    const event = makeEvent({
      reactions: { strength: 5, fire: 2, champion: 1, letsgo: 0 },
      my_reactions: ['champion'],
      reaction_count: 8,
    });
    const rolledBack = applyReactionToggle(applyReactionToggle(event, 'fire'), 'fire');
    expect(rolledBack.reactions).toEqual(event.reactions);
    expect(rolledBack.my_reactions).toEqual(event.my_reactions);
    expect(rolledBack.reaction_count).toBe(event.reaction_count);
  });

  it('never drops a count below zero', () => {
    const event = makeEvent({ my_reactions: ['fire'], reactions: { strength: 0, fire: 0, champion: 0, letsgo: 0 } });
    const next = applyReactionToggle(event, 'fire');
    expect(next.reactions.fire).toBe(0);
  });

  it('does not mutate the original event', () => {
    const event = makeEvent();
    applyReactionToggle(event, 'strength');
    expect(event.reactions.strength).toBe(0);
    expect(event.my_reactions).toEqual([]);
  });
});

describe('toggleReactionInList', () => {
  it('only updates the target event', () => {
    const a = makeEvent({ id: 'a' });
    const b = makeEvent({ id: 'b' });
    const result = toggleReactionInList([a, b], 'b', 'strength');
    expect(result[0]).toBe(a);
    expect(result[1].reactions.strength).toBe(1);
  });
});

// ─── Page merging ───────────────────────────────────────────────────────────

describe('mergeFeedEvents', () => {
  it('appends new pages and dedupes by id', () => {
    const page1 = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];
    const page2 = [makeEvent({ id: 'b' }), makeEvent({ id: 'c' })];
    const merged = mergeFeedEvents(page1, page2, 'append');
    expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('prepends realtime events and dedupes', () => {
    const existing = [makeEvent({ id: 'a' })];
    const fresh = [makeEvent({ id: 'new' }), makeEvent({ id: 'a' })];
    const merged = mergeFeedEvents(existing, fresh, 'prepend');
    expect(merged.map((e) => e.id)).toEqual(['new', 'a']);
  });

  it('dedupes duplicates within the incoming page itself', () => {
    const merged = mergeFeedEvents([], [makeEvent({ id: 'x' }), makeEvent({ id: 'x' })]);
    expect(merged).toHaveLength(1);
  });

  it('prepend inserts fresh events AFTER the pinned block', () => {
    const existing = [
      makeEvent({ id: 'pin-1', is_pinned: true }),
      makeEvent({ id: 'pin-2', is_pinned: true }),
      makeEvent({ id: 'old-1' }),
      makeEvent({ id: 'old-2' }),
    ];
    const merged = mergeFeedEvents(existing, [makeEvent({ id: 'new-1' })], 'prepend');
    expect(merged.map((e) => e.id)).toEqual(['pin-1', 'pin-2', 'new-1', 'old-1', 'old-2']);
  });

  it('prepend with no pinned block behaves like a plain prepend', () => {
    const existing = [makeEvent({ id: 'old-1' })];
    const merged = mergeFeedEvents(existing, [makeEvent({ id: 'new-1' })], 'prepend');
    expect(merged.map((e) => e.id)).toEqual(['new-1', 'old-1']);
  });
});

// ─── Filtering ──────────────────────────────────────────────────────────────

describe('filterFeedEvents', () => {
  const events = [
    makeEvent({ id: '1', event_type: 'pr_weight' }),
    makeEvent({ id: '2', event_type: 'achievement_earned' }),
    makeEvent({ id: '3', event_type: 'streak_milestone' }),
    makeEvent({ id: '4', event_type: 'challenge_joined' }),
    makeEvent({ id: '5', event_type: 'gym_announcement' }),
    makeEvent({ id: '6', event_type: 'level_up' }),
    makeEvent({ id: '7', event_type: 'goal_reached' }),
  ];

  it('returns everything for "all"', () => {
    expect(filterFeedEvents(events, 'all')).toHaveLength(7);
  });

  it('maps chips to real schema event types', () => {
    expect(filterFeedEvents(events, 'prs').map((e) => e.id)).toEqual(['1', '7']);
    expect(filterFeedEvents(events, 'achievements').map((e) => e.id)).toEqual(['2', '6']);
    expect(filterFeedEvents(events, 'streaks').map((e) => e.id)).toEqual(['3']);
    expect(filterFeedEvents(events, 'challenges').map((e) => e.id)).toEqual(['4']);
  });

  it('excludes announcements from every non-all filter', () => {
    (['prs', 'achievements', 'streaks', 'challenges'] as const).forEach((f) => {
      expect(filterFeedEvents(events, f).find((e) => e.id === '5')).toBeUndefined();
    });
  });
});

// ─── Workout share builder (DOC_05 §8 — web workoutShare.ts contract) ───────

describe('lbsFromKg', () => {
  it('converts kg to integer lbs with the exact factor', () => {
    expect(lbsFromKg(100)).toBe(220); // 220.462... → 220
    expect(lbsFromKg(0)).toBe(0);
    expect(lbsFromKg(5669.904625)).toBe(12_500);
  });
});

describe('buildWorkoutShare', () => {
  it('builds display_text with volume and plural PRs (web format, no name prefix)', () => {
    const share = buildWorkoutShare({
      volumeKg: 5669.904625, // exactly 12,500 lbs
      prsHit: 2,
      machinesUsed: ['Chest Press', 'Lat Pulldown'],
    });
    expect(share.display_text).toBe('finished training — 12,500 lbs, 2 PRs');
  });

  it('uses singular PR for one PR', () => {
    const share = buildWorkoutShare({ volumeKg: 100, prsHit: 1, machinesUsed: [] });
    expect(share.display_text).toBe('finished training — 220 lbs, 1 PR');
  });

  it('omits empty parts', () => {
    expect(
      buildWorkoutShare({ volumeKg: 100, prsHit: 0, machinesUsed: [] }).display_text,
    ).toBe('finished training — 220 lbs');
    expect(
      buildWorkoutShare({ volumeKg: 0, prsHit: 3, machinesUsed: [] }).display_text,
    ).toBe('finished training — 3 PRs');
    expect(
      buildWorkoutShare({ volumeKg: 0, prsHit: 0, machinesUsed: [] }).display_text,
    ).toBe('finished training');
  });

  it('produces the full WorkoutShareContext shape with volume stored in lbs', () => {
    const share = buildWorkoutShare({
      volumeKg: 100,
      prsHit: 2,
      machinesUsed: ['Leg Press'],
      completedAt: '2026-07-15T18:30:00.000Z',
    });
    expect(share.context_data).toEqual({
      share_status: 'completed',
      program_week: null,
      program_day: null,
      program_focus: null,
      sessions_completed_today: 1,
      prs_hit: 2,
      volume_lbs: 220,
      machines_used: ['Leg Press'],
      completed_at: '2026-07-15T18:30:00.000Z',
    });
  });

  it('defaults completed_at to now and clamps negative inputs to zero', () => {
    const before = Date.now();
    const share = buildWorkoutShare({ volumeKg: -50, prsHit: -1, machinesUsed: [] });
    const after = Date.now();
    expect(share.context_data.volume_lbs).toBe(0);
    expect(share.context_data.prs_hit).toBe(0);
    expect(share.display_text).toBe('finished training');
    const completedAt = new Date(share.context_data.completed_at as string).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before);
    expect(completedAt).toBeLessThanOrEqual(after);
  });

  it('round-trips through formatFeedEventText in both units', () => {
    const share = buildWorkoutShare({
      volumeKg: 5669.904625, // 12,500 lbs
      prsHit: 2,
      machinesUsed: [],
    });
    const event = makeEvent({
      event_type: 'workout_share',
      description: share.display_text,
      context_data: share.context_data as unknown as Record<string, unknown>,
    });
    expect(formatFeedEventText(event, 'lbs')).toBe('finished training — 12.5k lbs, 2 PRs');
    expect(formatFeedEventText(event, 'kg')).toBe('finished training — 5.7k kg, 2 PRs');
  });
});

describe('shareDateUtc', () => {
  it('returns the UTC calendar date (workout_share_log.shared_at key)', () => {
    expect(shareDateUtc(new Date('2026-07-15T23:59:59Z'))).toBe('2026-07-15');
    expect(shareDateUtc(new Date('2026-07-15T00:00:00Z'))).toBe('2026-07-15');
  });

  it('uses UTC, not local time, across the day boundary', () => {
    // 23:30 at UTC-2 is already 01:30 next day in UTC
    expect(shareDateUtc(new Date('2026-07-15T23:30:00-02:00'))).toBe('2026-07-16');
  });
});
