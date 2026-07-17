-- ═══════════════════════════════════════════════════════════════════
-- Migration 025: mobile feed writes (DOC_05 Mobile Social Feed)
-- ═══════════════════════════════════════════════════════════════════
-- The mobile app talks to Supabase directly under RLS (it cannot use
-- web-admin's cookie-authenticated routes). Two gaps blocked the
-- DOC_05 share flow:
--
-- 1. gym_feed_events INSERT was owner-only (feed_owner_write, 001),
--    so members could not post workout_share events from mobile.
--    workout_share_log already has an own-member policy (009).
-- 2. increment_comment_count (004) is invoker-rights SQL; members
--    have no UPDATE grant on gym_feed_events, so comment counts
--    silently no-oped for mobile commenters.
--
-- Rollback:
--   DROP POLICY IF EXISTS "feed_member_share_insert" ON gym_feed_events;
--   CREATE OR REPLACE FUNCTION increment_comment_count(p_event_id uuid, p_delta int)
--     RETURNS void LANGUAGE sql AS $rollback$
--       UPDATE gym_feed_events
--       SET comment_count = GREATEST(comment_count + p_delta, 0)
--       WHERE id = p_event_id;
--     $rollback$;

-- Members may insert ONLY their own workout_share events, in their own gym.
CREATE POLICY "feed_member_share_insert"
  ON gym_feed_events FOR INSERT
  WITH CHECK (
    event_type = 'workout_share'
    AND is_gym_member(gym_id)
    AND member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- SECURITY DEFINER so authenticated members can bump counts without an
-- UPDATE policy on gym_feed_events. Guard: a logged-in caller must be a
-- member of the event's gym; service contexts (auth.uid() IS NULL) pass.
-- anon cannot execute at all (revoked below).
CREATE OR REPLACE FUNCTION increment_comment_count(p_event_id uuid, p_delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM gym_feed_events e
      WHERE e.id = p_event_id AND is_gym_member(e.gym_id)
    ) THEN
      RETURN;
    END IF;
  END IF;

  UPDATE gym_feed_events
  SET comment_count = GREATEST(comment_count + p_delta, 0)
  WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_comment_count(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_comment_count(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION increment_comment_count(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_comment_count(uuid, int) TO service_role;
