-- ============================================================================
-- Migration 011: Medium Audit Fixes
-- Addresses MEDIUM-severity audit findings across Phases 8.3-8.4
-- ============================================================================

-- ─── M-8.3-3: Restrict trainer check-in RLS to SELECT + UPDATE only ────────
-- Trainers should NOT be able to INSERT or DELETE check-ins directly.

DROP POLICY IF EXISTS "checkins_trainer" ON weekly_checkins;

CREATE POLICY "checkins_trainer_select"
  ON weekly_checkins FOR SELECT
  USING (trainer_id = auth.uid());

CREATE POLICY "checkins_trainer_update"
  ON weekly_checkins FOR UPDATE
  USING (trainer_id = auth.uid());

-- ─── M-8.3-1: Cleanup cron should also clean old replied check-ins ─────────
-- Previous cron kept replied check-ins forever. Now clean replied after 2 years.

DO $$
BEGIN
  PERFORM cron.unschedule('nexera-clean-old-checkins');
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_cron may not be available
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'nexera-clean-old-checkins',
    '0 7 * * 0',
    'DELETE FROM weekly_checkins WHERE (week_start < CURRENT_DATE - 365 AND member_replied = false) OR (week_start < CURRENT_DATE - 730)'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — skipping check-in cleanup schedule';
END;
$$;

-- ─── M-8.4-7: Challenge join should verify member belongs to gym ───────────
-- Add gym_id index on challenge_entries for efficient gym-scoped queries
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_challenge_participants_gym ON challenge_participants(gym_id);
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'challenge_participants.gym_id not found — skipping index';
END;
$$;

-- ─── M-8.4-8: Feed should filter hidden events ────────────────────────────
-- Add index to support priority filtering
CREATE INDEX IF NOT EXISTS idx_feed_events_priority
  ON gym_feed_events(gym_id, priority)
  WHERE priority != 'hidden';

-- ─── M-8.5-4: Trainer RLS for DNA snapshots ───────────────────────────────
-- Trainers should be able to read DNA snapshots for their assigned members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'member_dna_snapshots') THEN
    EXECUTE 'CREATE POLICY "dna_snapshots_trainer_read" ON member_dna_snapshots FOR SELECT USING (
      member_id IN (
        SELECT id FROM members WHERE assigned_trainer_id = auth.uid()
      )
    )';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- policy already exists
END;
$$;
