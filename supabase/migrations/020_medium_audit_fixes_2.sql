-- Migration 020: Medium audit fixes batch 2
-- M-023: Add 'hidden' to gym_feed_events.priority CHECK constraint
-- M-024: Tighten RLS on program tables (017) from USING(true) to service_role only

-- ─── M-023: Fix priority CHECK to include 'hidden' ─────────────────────────
ALTER TABLE gym_feed_events DROP CONSTRAINT IF EXISTS gym_feed_events_priority_check;
ALTER TABLE gym_feed_events ADD CONSTRAINT gym_feed_events_priority_check
  CHECK (priority IN ('high', 'medium', 'low', 'hidden'));

-- ─── M-024: Tighten program table RLS policies ─────────────────────────────
-- Drop the overly permissive USING(true) policies and replace with service_role only

-- programs table
DROP POLICY IF EXISTS "programs_all" ON programs;
CREATE POLICY "programs_service_role" ON programs FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "programs_read_gym_member" ON programs FOR SELECT
  USING (gym_id IN (SELECT gym_id FROM members WHERE user_id = auth.uid()));

-- program_days table
DROP POLICY IF EXISTS "program_days_all" ON program_days;
CREATE POLICY "program_days_service_role" ON program_days FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "program_days_read" ON program_days FOR SELECT
  USING (program_id IN (SELECT id FROM programs WHERE gym_id IN (SELECT gym_id FROM members WHERE user_id = auth.uid())));

-- program_exercises table
DROP POLICY IF EXISTS "program_exercises_all" ON program_exercises;
CREATE POLICY "program_exercises_service_role" ON program_exercises FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "program_exercises_read" ON program_exercises FOR SELECT
  USING (program_day_id IN (SELECT id FROM program_days WHERE program_id IN (SELECT id FROM programs WHERE gym_id IN (SELECT gym_id FROM members WHERE user_id = auth.uid()))));

-- member_program_assignments table
DROP POLICY IF EXISTS "member_program_assignments_all" ON member_program_assignments;
CREATE POLICY "mpa_service_role" ON member_program_assignments FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "mpa_read_own" ON member_program_assignments FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
