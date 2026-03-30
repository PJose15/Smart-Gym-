-- Fix #1: priority DEFAULT 'normal' violates CHECK constraint ('high','medium','low')
-- All inserts that omit priority silently fail because DEFAULT doesn't match CHECK
ALTER TABLE gym_feed_events ALTER COLUMN priority SET DEFAULT 'medium';

-- Fix #9: Atomic comment_count increment/decrement RPC (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_comment_count(p_event_id uuid, p_delta int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE gym_feed_events
  SET comment_count = GREATEST(comment_count + p_delta, 0)
  WHERE id = p_event_id;
$$;
