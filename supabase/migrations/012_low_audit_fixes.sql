-- ============================================================================
-- Migration 012: Low Audit Fixes
-- Adds missing event types to gym_feed_events CHECK constraint
-- ============================================================================

-- L1: Add 'archetype_change' to the event_type CHECK constraint
ALTER TABLE gym_feed_events DROP CONSTRAINT IF EXISTS gym_feed_events_event_type_check;
ALTER TABLE gym_feed_events ADD CONSTRAINT gym_feed_events_event_type_check
  CHECK (event_type IN (
    'pr_weight', 'pr_volume', 'streak_milestone',
    'program_complete', 'session_milestone', 'level_up',
    'achievement_earned', 'challenge_launched', 'challenge_joined',
    'challenge_rank_1', 'challenge_podium', 'challenge_complete',
    'member_spotlight', 'gym_announcement', 'new_member', 'goal_reached',
    'workout_share', 'archetype_change'
  ));
