-- ============================================================
-- Phase 3: Fix profiles RLS + add missing indexes
-- ============================================================

-- Allow users to read profiles of other members in their gyms.
-- This is required for admin dashboard, members page, and workout
-- history views that join on profiles(email, full_name).
CREATE POLICY "profiles_select_gym_members" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT profile_id FROM gym_members
      WHERE gym_id IN (SELECT get_my_gym_ids())
    )
  );

-- Drop the overly restrictive own-only select policy
-- (replaced by the gym-aware policy above)
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

-- Add indexes for feature_flags individual lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_profile ON feature_flags(profile_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_gym ON feature_flags(gym_id);

-- Add index for workouts by profile + status (used in home screen)
CREATE INDEX IF NOT EXISTS idx_workouts_profile_status ON workouts(profile_id, status);
