-- ============================================================
-- SmartGym Row Level Security Policies
-- ============================================================
-- Run AFTER the initial migration.
-- These policies enforce multi-gym data isolation.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ───────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile (on signup)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ─── GYMS ───────────────────────────────────────────────────

-- Members can read gyms they belong to
CREATE POLICY "gyms_select_member" ON gyms
  FOR SELECT USING (id IN (SELECT get_my_gym_ids()));

-- Owners can update their gyms
CREATE POLICY "gyms_update_owner" ON gyms
  FOR UPDATE USING (has_gym_role(id, ARRAY['owner']::user_role[]));

-- Any authenticated user can create a gym (they become owner via application logic)
CREATE POLICY "gyms_insert" ON gyms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── GYM MEMBERS ───────────────────────────────────────────

-- Users can see members in their gyms
CREATE POLICY "gym_members_select" ON gym_members
  FOR SELECT USING (gym_id IN (SELECT get_my_gym_ids()));

-- Owners/trainers can manage members
CREATE POLICY "gym_members_insert" ON gym_members
  FOR INSERT WITH CHECK (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE POLICY "gym_members_update" ON gym_members
  FOR UPDATE USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

CREATE POLICY "gym_members_delete" ON gym_members
  FOR DELETE USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

-- ─── MACHINES ───────────────────────────────────────────────

-- PUBLIC: Anyone can look up a machine by qr_slug (core QR scan flow).
-- This uses a Postgres function for controlled access without full table scan.
-- Authenticated gym members can also browse all machines in their gym.
CREATE POLICY "machines_select_member" ON machines
  FOR SELECT USING (
    gym_id IN (SELECT get_my_gym_ids())
  );

-- Allow anon/unauthenticated reads via the RPC function (see get_machine_by_slug below).
-- Direct table reads for anon users are blocked — they must use the RPC.

-- Owners/trainers can manage machines
CREATE POLICY "machines_insert" ON machines
  FOR INSERT WITH CHECK (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE POLICY "machines_update" ON machines
  FOR UPDATE USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE POLICY "machines_delete" ON machines
  FOR DELETE USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

-- ─── PROGRAMS ───────────────────────────────────────────────

CREATE POLICY "programs_select" ON programs
  FOR SELECT USING (gym_id IN (SELECT get_my_gym_ids()));

CREATE POLICY "programs_insert" ON programs
  FOR INSERT WITH CHECK (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE POLICY "programs_update" ON programs
  FOR UPDATE USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE POLICY "programs_delete" ON programs
  FOR DELETE USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

-- ─── PROGRAM DAYS ───────────────────────────────────────────

CREATE POLICY "program_days_select" ON program_days
  FOR SELECT USING (
    program_id IN (SELECT id FROM programs WHERE gym_id IN (SELECT get_my_gym_ids()))
  );

CREATE POLICY "program_days_insert" ON program_days
  FOR INSERT WITH CHECK (
    program_id IN (SELECT id FROM programs WHERE has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]))
  );

CREATE POLICY "program_days_update" ON program_days
  FOR UPDATE USING (
    program_id IN (SELECT id FROM programs WHERE has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]))
  );

CREATE POLICY "program_days_delete" ON program_days
  FOR DELETE USING (
    program_id IN (SELECT id FROM programs WHERE has_gym_role(gym_id, ARRAY['owner']::user_role[]))
  );

-- ─── PROGRAM EXERCISES ─────────────────────────────────────

CREATE POLICY "program_exercises_select" ON program_exercises
  FOR SELECT USING (
    program_day_id IN (
      SELECT pd.id FROM program_days pd
      JOIN programs p ON p.id = pd.program_id
      WHERE p.gym_id IN (SELECT get_my_gym_ids())
    )
  );

CREATE POLICY "program_exercises_insert" ON program_exercises
  FOR INSERT WITH CHECK (
    program_day_id IN (
      SELECT pd.id FROM program_days pd
      JOIN programs p ON p.id = pd.program_id
      WHERE has_gym_role(p.gym_id, ARRAY['owner', 'trainer']::user_role[])
    )
  );

CREATE POLICY "program_exercises_update" ON program_exercises
  FOR UPDATE USING (
    program_day_id IN (
      SELECT pd.id FROM program_days pd
      JOIN programs p ON p.id = pd.program_id
      WHERE has_gym_role(p.gym_id, ARRAY['owner', 'trainer']::user_role[])
    )
  );

CREATE POLICY "program_exercises_delete" ON program_exercises
  FOR DELETE USING (
    program_day_id IN (
      SELECT pd.id FROM program_days pd
      JOIN programs p ON p.id = pd.program_id
      WHERE has_gym_role(p.gym_id, ARRAY['owner']::user_role[])
    )
  );

-- ─── MEMBER PROGRAM ASSIGNMENTS ─────────────────────────────

CREATE POLICY "mpa_select" ON member_program_assignments
  FOR SELECT USING (
    gym_id IN (SELECT get_my_gym_ids())
  );

CREATE POLICY "mpa_insert" ON member_program_assignments
  FOR INSERT WITH CHECK (
    has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );

CREATE POLICY "mpa_delete" ON member_program_assignments
  FOR DELETE USING (
    has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );

-- ─── WORKOUTS ───────────────────────────────────────────────

-- Members can read their own workouts
CREATE POLICY "workouts_select_own" ON workouts
  FOR SELECT USING (profile_id = auth.uid());

-- Trainers/owners can read workouts in their gym
CREATE POLICY "workouts_select_staff" ON workouts
  FOR SELECT USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Members can only create their own workouts
CREATE POLICY "workouts_insert" ON workouts
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

-- Members can update their own workouts (e.g., set finished_at)
CREATE POLICY "workouts_update_own" ON workouts
  FOR UPDATE USING (profile_id = auth.uid());

-- ─── WORKOUT EXERCISES ──────────────────────────────────────

CREATE POLICY "workout_exercises_select" ON workout_exercises
  FOR SELECT USING (
    workout_id IN (SELECT id FROM workouts WHERE profile_id = auth.uid())
    OR workout_id IN (SELECT id FROM workouts WHERE has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]))
  );

CREATE POLICY "workout_exercises_insert" ON workout_exercises
  FOR INSERT WITH CHECK (
    workout_id IN (SELECT id FROM workouts WHERE profile_id = auth.uid())
  );

-- ─── SETS ───────────────────────────────────────────────────

CREATE POLICY "sets_select" ON sets
  FOR SELECT USING (
    workout_exercise_id IN (
      SELECT we.id FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.profile_id = auth.uid()
    )
    OR workout_exercise_id IN (
      SELECT we.id FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE has_gym_role(w.gym_id, ARRAY['owner', 'trainer']::user_role[])
    )
  );

CREATE POLICY "sets_insert" ON sets
  FOR INSERT WITH CHECK (
    workout_exercise_id IN (
      SELECT we.id FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.profile_id = auth.uid()
    )
  );

CREATE POLICY "sets_update" ON sets
  FOR UPDATE USING (
    workout_exercise_id IN (
      SELECT we.id FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.profile_id = auth.uid()
    )
  );

-- ─── POINTS LEDGER ──────────────────────────────────────────

CREATE POLICY "points_select_own" ON points_ledger
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "points_select_staff" ON points_ledger
  FOR SELECT USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Only staff can award points. Members cannot self-award.
CREATE POLICY "points_insert" ON points_ledger
  FOR INSERT WITH CHECK (
    has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );
