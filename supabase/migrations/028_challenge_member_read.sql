-- 028_challenge_member_read.sql
-- Members can SELECT all challenge_participants rows in their own gym.
-- Needed for the mobile challenge leaderboard (Phase 3 / CHAL-04).
-- Without this, direct-Supabase leaderboard reads under RLS silently return
-- 0 rows for non-owner members ("challenge_participants_own" covers only the
-- member's own row; "challenge_participants_gym_read" is owner-scoped).
-- Mirrors "challenges_gym_members_read" on gym_challenges (migration 001).

CREATE POLICY "challenge_participants_member_gym_read"
  ON challenge_participants FOR SELECT
  USING (is_gym_member(gym_id));
