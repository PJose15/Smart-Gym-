import { formatFeedEvent } from '../formatFeedEvent';
import type { FeedEventFull } from '@nexera/types';

function baseEvent(overrides: Partial<FeedEventFull>): FeedEventFull {
  return {
    id: 'evt-1',
    event_type: 'pr_weight',
    member_name: 'Alice',
    description: 'hit a new personal best — 225 lbs!',
    created_at: '2026-04-11T12:00:00Z',
    reaction_count: 0,
    member_id: 'm-1',
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

describe('formatFeedEvent', () => {
  describe('pr_weight', () => {
    it('returns lbs-formatted string without name prefix', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        context_data: { best_weight_lbs: 225 },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit a new personal best — 225 lbs!');
    });

    it('converts to kg when unit=kg', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        context_data: { best_weight_lbs: 225 },
      });
      // 225 × 0.45359237 = 102.06 → rounds to 102
      expect(formatFeedEvent(event, 'kg')).toBe('hit a new personal best — 102 kg!');
    });

    it('falls back to event.description when best_weight_lbs missing', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        description: 'Server-baked fallback',
        context_data: {},
      });
      expect(formatFeedEvent(event, 'kg')).toBe('Server-baked fallback');
    });

    it('falls back when best_weight_lbs is not a number', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        description: 'fallback',
        context_data: { best_weight_lbs: 'not a number' },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('fallback');
    });

    it('never includes a name prefix regardless of member_name', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        member_name: 'Alice',
        context_data: { best_weight_lbs: 225 },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit a new personal best — 225 lbs!');
    });

    it('includes machine_name when present (pr-check enriched context)', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        context_data: { best_weight_lbs: 225, machine_name: 'Chest Press', pr_type: 'weight' },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit a new personal best on Chest Press — 225 lbs!');
    });
  });

  describe('pr_volume', () => {
    it('rebuilds volume in kg with machine_name', () => {
      const event = baseEvent({
        event_type: 'pr_volume',
        context_data: { volume_lbs: 12500, machine_name: 'Leg Press', pr_type: 'volume' },
      });
      // 12500 × 0.45359237 = 5669.9 → 5.7k kg
      expect(formatFeedEvent(event, 'kg')).toBe('hit a volume PR on Leg Press — 5.7k kg!');
    });

    it('rebuilds volume in lbs without machine_name', () => {
      const event = baseEvent({
        event_type: 'pr_volume',
        context_data: { volume_lbs: 12500 },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit a volume PR — 12.5k lbs!');
    });

    it('falls back to description when volume_lbs missing', () => {
      const event = baseEvent({
        event_type: 'pr_volume',
        description: 'New volume PR!',
        context_data: { pr_type: 'volume' },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('New volume PR!');
    });
  });

  describe('goal_reached', () => {
    it('includes machine_name and converts target to kg', () => {
      const event = baseEvent({
        event_type: 'goal_reached',
        context_data: { target_weight: 315, machine_name: 'Leg Press' },
      });
      // 315 × 0.45359237 = 142.88 → 143
      expect(formatFeedEvent(event, 'kg')).toBe('hit their goal on Leg Press — 143 kg!');
    });

    it('omits machine_name when missing', () => {
      const event = baseEvent({
        event_type: 'goal_reached',
        context_data: { target_weight: 100 },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit their goal — 100 lbs!');
    });

    it('falls back when target_weight missing', () => {
      const event = baseEvent({
        event_type: 'goal_reached',
        description: 'goal fallback',
        context_data: {},
      });
      expect(formatFeedEvent(event, 'kg')).toBe('goal fallback');
    });
  });

  describe('workout_share', () => {
    it('formats completed share with volume + PRs in kg', () => {
      const event = baseEvent({
        event_type: 'workout_share',
        context_data: {
          share_status: 'completed',
          volume_lbs: 12500,
          prs_hit: 2,
        },
      });
      // formatVolume(12500, 'kg') = (12500 × 0.45359 = 5669.9) / 1000 = 5.7k kg
      expect(formatFeedEvent(event, 'kg')).toBe('finished training — 5.7k kg, 2 PRs');
    });

    it('pluralizes PR correctly (singular)', () => {
      const event = baseEvent({
        event_type: 'workout_share',
        context_data: { share_status: 'completed', volume_lbs: 500, prs_hit: 1 },
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('finished training — 500 lbs, 1 PR');
    });

    it('returns fallback for non-completed shares', () => {
      const event = baseEvent({
        event_type: 'workout_share',
        description: 'is training today',
        context_data: { share_status: 'training', volume_lbs: 0, prs_hit: 0 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('is training today');
    });

    it('falls back when completed share has no numeric totals', () => {
      const event = baseEvent({
        event_type: 'workout_share',
        description: 'server baked',
        context_data: { share_status: 'completed', volume_lbs: 0, prs_hit: 0 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('server baked');
    });
  });

  describe('passthrough event types', () => {
    it('streak_milestone → returns description unchanged', () => {
      const event = baseEvent({
        event_type: 'streak_milestone',
        description: 'is on a 7-day streak!',
        context_data: { streak: 7 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('is on a 7-day streak!');
    });

    it('level_up → returns description unchanged', () => {
      const event = baseEvent({
        event_type: 'level_up',
        description: 'reached Level 5!',
        context_data: { new_level: 5 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('reached Level 5!');
    });

    it('achievement_earned → returns description unchanged', () => {
      const event = baseEvent({
        event_type: 'achievement_earned',
        description: 'earned "First Steps"',
        context_data: { achievement_code: 'first_steps' },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('earned "First Steps"');
    });

    it('unknown event type → returns description unchanged', () => {
      const event = baseEvent({
        event_type: 'mystery_event',
        description: 'something happened',
        context_data: {},
      });
      expect(formatFeedEvent(event, 'kg')).toBe('something happened');
    });
  });

  describe('legacy name-prefix stripping', () => {
    it('strips "Alice " prefix from legacy pr_weight fallback', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        member_name: 'Alice',
        description: 'Alice hit a new personal best — 225 lbs!',
        context_data: {},
      });
      expect(formatFeedEvent(event, 'lbs')).toBe('hit a new personal best — 225 lbs!');
    });

    it('strips "Bob " prefix from passthrough streak event', () => {
      const event = baseEvent({
        event_type: 'streak_milestone',
        member_name: 'Bob',
        description: 'Bob is on a 7-day streak!',
        context_data: { streak: 7 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('is on a 7-day streak!');
    });

    it('leaves description untouched if it does not start with the name', () => {
      const event = baseEvent({
        event_type: 'pr_volume',
        member_name: 'Alice',
        description: 'New volume PR!',
        context_data: {},
      });
      expect(formatFeedEvent(event, 'kg')).toBe('New volume PR!');
    });

    it('no-op strip when member_name is empty', () => {
      const event = baseEvent({
        event_type: 'streak_milestone',
        member_name: '',
        description: 'is on a 3-day streak!',
        context_data: { streak: 3 },
      });
      expect(formatFeedEvent(event, 'kg')).toBe('is on a 3-day streak!');
    });
  });

  describe('null / undefined context_data', () => {
    it('treats null context_data as empty and falls back', () => {
      const event = baseEvent({
        event_type: 'pr_weight',
        description: 'fallback description',
        context_data: null as unknown as Record<string, unknown>,
      });
      expect(formatFeedEvent(event, 'kg')).toBe('fallback description');
    });
  });
});
