-- ═══════════════════════════════════════════════════════════════════
-- Migration 034: security hardening — RLS/policy layer
-- (AUDIT_2026-08-25 Stage 1: SEC-C1, SEC-C2, DB-H1, DB-H2, DB-H6, H-1)
-- ═══════════════════════════════════════════════════════════════════
-- Closes takeover-grade and cross-tenant holes at the policy layer.
-- Service role bypasses RLS, so all web-admin server routes (which use
-- the admin client) are unaffected by every change below.
--
-- Rollback: restore the original policies from 001 / the get_leaderboard
-- body from 002+033 (see each section).

-- ─── SEC-C1: block self-escalation to super_admin ───────────────────
-- 001's `users_own_profile FOR ALL USING (id = auth.uid())` had no
-- WITH CHECK, so a member could PATCH their own row to
-- platform_role='super_admin'. Split into SELECT + UPDATE and freeze
-- platform_role via a SECURITY DEFINER helper (avoids RLS self-recursion).
-- INSERT/DELETE of users rows stays service-role only (signup trigger /
-- admin API). Role changes by admins still work — they run as service role.

CREATE OR REPLACE FUNCTION current_platform_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT platform_role FROM users WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION current_platform_role() FROM anon;
GRANT EXECUTE ON FUNCTION current_platform_role() TO authenticated, service_role;

DROP POLICY IF EXISTS "users_own_profile" ON users;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role = current_platform_role()
  );

-- ─── SEC-C2: drop the surviving USING(true) program policies ────────
-- 017 created these FOR ALL USING(true) WITH CHECK(true); 020 tried to
-- drop them under the wrong names (programs_all, …) so they survived,
-- leaving every gym's program templates world-read/writable. 020's
-- correctly-scoped policies (programs_service_role, programs_read_gym_member,
-- and siblings) remain in force after these drops.

DROP POLICY IF EXISTS "service_role_programs" ON programs;
DROP POLICY IF EXISTS "service_role_program_days" ON program_days;
DROP POLICY IF EXISTS "service_role_program_exercises" ON program_exercises;
DROP POLICY IF EXISTS "service_role_member_program_assignments" ON member_program_assignments;

-- ─── DB-H1: feed reactions/comments — bind writes to the caller ─────
-- 001's FOR ALL policies scoped only by gym membership of the event, so
-- any gym member could insert/edit/delete reactions & comments AS another
-- member. Keep gym-scoped SELECT; bind INSERT/UPDATE/DELETE to own member.

DROP POLICY IF EXISTS "reactions_gym_members" ON feed_reactions;

CREATE POLICY "reactions_read"
  ON feed_reactions FOR SELECT
  USING (event_id IN (SELECT id FROM gym_feed_events WHERE is_gym_member(gym_id)));

CREATE POLICY "reactions_insert_own"
  ON feed_reactions FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    AND event_id IN (SELECT id FROM gym_feed_events WHERE is_gym_member(gym_id))
  );

CREATE POLICY "reactions_update_own"
  ON feed_reactions FOR UPDATE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "reactions_delete_own"
  ON feed_reactions FOR DELETE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "comments_gym_members" ON feed_comments;

CREATE POLICY "comments_read"
  ON feed_comments FOR SELECT
  USING (event_id IN (SELECT id FROM gym_feed_events WHERE is_gym_member(gym_id)));

CREATE POLICY "comments_insert_own"
  ON feed_comments FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    AND event_id IN (SELECT id FROM gym_feed_events WHERE is_gym_member(gym_id))
  );

CREATE POLICY "comments_update_own"
  ON feed_comments FOR UPDATE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "comments_delete_own"
  ON feed_comments FOR DELETE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- ─── DB-H2: trainer messages — members can't forge the trainer side ─
-- 001's trainer_messages_member FOR ALL constrained only member_id, so a
-- member could INSERT sender_type='trainer' (impersonation) and edit/delete
-- the trainer's messages. Members get read on their thread + send as
-- 'member' only. Read-receipts / edits happen server-side (service role).

DROP POLICY IF EXISTS "trainer_messages_member" ON trainer_member_messages;

CREATE POLICY "trainer_messages_member_read"
  ON trainer_member_messages FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "trainer_messages_member_send"
  ON trainer_member_messages FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    AND sender_type = 'member'
  );

-- ─── DB-H6: challenge participants — no score/rank tampering ────────
-- 001's challenge_participants_own FOR ALL let members UPDATE their own
-- current_score/current_rank (cheat any challenge) and INSERT arbitrary
-- challenge/gym pairings. Reads remain via 028 (gym-scoped). Joins may
-- insert their own row only, with score/rank forced to 0; all score
-- updates are service-role only (challenge scoring runs server-side).

DROP POLICY IF EXISTS "challenge_participants_own" ON challenge_participants;

CREATE POLICY "challenge_participants_join_self"
  ON challenge_participants FOR INSERT
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    AND is_gym_member(gym_id)
    AND current_score = 0
    AND current_rank = 0
  );

-- ─── H-1: leaderboard gym-membership guard (defence in depth) ───────
-- 033 made get_leaderboard SECURITY DEFINER with no internal guard, so a
-- member could read any gym's ranking (uuid + points only — low
-- sensitivity, but the guard is cheap). Service-role callers (web API)
-- bypass the guard. Rewritten as plpgsql; body otherwise identical to 002.

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_gym_id uuid,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(profile_id uuid, total_points bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
     AND NOT is_gym_member(p_gym_id) THEN
    RAISE EXCEPTION 'not a member of gym %', p_gym_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  -- All-time: rank by smartgym_score
  (SELECT
    m.user_id AS profile_id,
    m.smartgym_score::bigint AS total_points
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.is_active = true
    AND m.user_id IS NOT NULL
    AND m.smartgym_score > 0
    AND p_since IS NULL
  ORDER BY m.smartgym_score DESC
  LIMIT p_limit)

  UNION ALL

  -- Weekly: rank by total volume since p_since (using session_date)
  (SELECT
    m.user_id AS profile_id,
    COALESCE(SUM(ws.total_volume_lbs), 0)::bigint AS total_points
  FROM members m
  LEFT JOIN workout_sessions ws
    ON ws.member_id = m.id
    AND ws.completed_at IS NOT NULL
    AND ws.session_date >= p_since::date
  WHERE m.gym_id = p_gym_id
    AND m.is_active = true
    AND m.user_id IS NOT NULL
    AND p_since IS NOT NULL
  GROUP BY m.user_id
  HAVING COALESCE(SUM(ws.total_volume_lbs), 0) > 0
  ORDER BY total_points DESC
  LIMIT p_limit);
END;
$$;
