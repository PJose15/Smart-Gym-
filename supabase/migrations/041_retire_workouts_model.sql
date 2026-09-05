-- ============================================================
-- Migration 041: Retire the legacy mobile workout model
-- Stage 4b of FIX_PLAN_2026-08-25 (workout-model consolidation).
--
-- Mobile now logs to workout_sessions (lbs) via /api/sessions —
-- the same path as the web scan flow — so the tables migration
-- 021 created to mirror mobile's old code (workouts,
-- workout_exercises, workout_sets + the `sets` view) are dropped.
-- The badge compatibility views from 022 (badges, member_badges)
-- are also dropped: mobile badgeService now reads
-- achievement_definitions / member_achievements directly.
--
-- Pre-launch: aggressive drops, no data backfill (per plan).
-- ============================================================

-- ── 1. Re-point set_feedback at workout_sessions ─────────────
-- Discomfort feedback survives; its per-set identity becomes
-- (session_id, set_number) into the sets JSONB array.
ALTER TABLE set_feedback DROP COLUMN IF EXISTS workout_id;
ALTER TABLE set_feedback DROP COLUMN IF EXISTS workout_exercise_id;
ALTER TABLE set_feedback DROP COLUMN IF EXISTS set_id;
ALTER TABLE set_feedback
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES workout_sessions(id) ON DELETE SET NULL;
ALTER TABLE set_feedback
  ADD COLUMN IF NOT EXISTS set_number integer;

CREATE INDEX IF NOT EXISTS idx_set_feedback_session ON set_feedback(session_id);

-- ── 2. Re-point coach_note_drafts.workout_id ─────────────────
-- The column now stores a workout_sessions id (trainer-copilot
-- generate-workout-draft reads sessions). Old values referenced
-- retired workouts rows — null them before swapping the FK.
UPDATE coach_note_drafts SET workout_id = NULL WHERE workout_id IS NOT NULL;
ALTER TABLE coach_note_drafts
  DROP CONSTRAINT IF EXISTS coach_note_drafts_workout_id_fkey;
ALTER TABLE coach_note_drafts
  ADD CONSTRAINT coach_note_drafts_workout_id_fkey
    FOREIGN KEY (workout_id) REFERENCES workout_sessions(id) ON DELETE SET NULL;

-- ── 3. Drop the compatibility views ──────────────────────────
DROP VIEW IF EXISTS sets;
DROP VIEW IF EXISTS badges;
DROP VIEW IF EXISTS member_badges;

-- ── 4. Drop the legacy tables ────────────────────────────────
DROP TABLE IF EXISTS workout_sets CASCADE;
DROP TABLE IF EXISTS workout_exercises CASCADE;
DROP TABLE IF EXISTS workouts CASCADE;
