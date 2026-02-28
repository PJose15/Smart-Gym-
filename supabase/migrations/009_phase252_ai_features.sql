-- ============================================================
-- Phase 2.5.2: Machine Alternatives, Form Checklist, Guardrails
-- ============================================================

-- ─── Machine Tagging Expansion ────────────────────────────
-- movement_pattern and equipment_type already exist (nullable) from 008.
-- Add NOT NULL defaults, CHECK constraints, and new columns.

-- Add difficulty column
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'beginner';

-- Add primary_muscles and secondary_muscles arrays
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS primary_muscles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] NOT NULL DEFAULT '{}';

-- Add freeform tags
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS tags TEXT[] NULL;

-- Add form checklist columns
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS form_checklist_before TEXT[] NULL;

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS form_checklist_during TEXT[] NULL;

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS form_checklist_after TEXT[] NULL;

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS checklist_version INT NOT NULL DEFAULT 1;

-- Backfill movement_pattern and equipment_type with defaults for existing rows
UPDATE machines SET movement_pattern = 'unknown' WHERE movement_pattern IS NULL;
UPDATE machines SET equipment_type = 'machine' WHERE equipment_type IS NULL;

-- Set NOT NULL with defaults
ALTER TABLE machines
  ALTER COLUMN movement_pattern SET NOT NULL,
  ALTER COLUMN movement_pattern SET DEFAULT 'unknown';

ALTER TABLE machines
  ALTER COLUMN equipment_type SET NOT NULL,
  ALTER COLUMN equipment_type SET DEFAULT 'machine';

-- CHECK constraints for enums
ALTER TABLE machines
  ADD CONSTRAINT chk_movement_pattern
    CHECK (movement_pattern IN ('push', 'pull', 'squat', 'hinge', 'carry', 'core', 'isolation', 'unknown'));

ALTER TABLE machines
  ADD CONSTRAINT chk_equipment_type
    CHECK (equipment_type IN ('machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'smith', 'cardio', 'unknown'));

ALTER TABLE machines
  ADD CONSTRAINT chk_difficulty
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));

-- ─── Indexes for machine alternatives ─────────────────────

CREATE INDEX IF NOT EXISTS idx_machines_gym_movement
  ON machines (gym_id, movement_pattern);

CREATE INDEX IF NOT EXISTS idx_machines_gym_equipment
  ON machines (gym_id, equipment_type);

CREATE INDEX IF NOT EXISTS idx_machines_gym_primary_muscles
  ON machines USING GIN (primary_muscles);

-- ─── Set Feedback Table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS set_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id          UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_id              UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  feedback            TEXT NOT NULL CHECK (feedback IN ('ok', 'unstable', 'discomfort')),
  body_area           TEXT NULL CHECK (body_area IS NULL OR body_area IN ('knee', 'shoulder', 'back', 'wrist', 'neck', 'other')),
  notes               TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE set_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert and read their own feedback
CREATE POLICY "set_feedback_own_insert"
  ON set_feedback FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "set_feedback_own_select"
  ON set_feedback FOR SELECT
  USING (profile_id = auth.uid());

-- Staff can read feedback for their gym
CREATE POLICY "set_feedback_staff_read"
  ON set_feedback FOR SELECT
  USING (gym_id IN (SELECT get_my_gym_ids()));

CREATE INDEX IF NOT EXISTS idx_set_feedback_profile
  ON set_feedback (profile_id);

CREATE INDEX IF NOT EXISTS idx_set_feedback_workout
  ON set_feedback (workout_id);

-- ─── AI Guardrail Insights Table ──────────────────────────

CREATE TABLE IF NOT EXISTS ai_guardrail_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type        TEXT NOT NULL CHECK (insight_type IN ('volume_spike', 'high_rpe', 'rep_collapse', 'recovery_overlap')),
  severity            TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  confidence          NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  message             TEXT NOT NULL,
  recommended_action  TEXT NOT NULL CHECK (recommended_action IN ('reduce_load', 'reduce_sets', 'rest_day', 'deload_light')),
  meta                JSONB NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NULL
);

ALTER TABLE ai_guardrail_insights ENABLE ROW LEVEL SECURITY;

-- Users can read their own insights
CREATE POLICY "guardrail_insights_own_select"
  ON ai_guardrail_insights FOR SELECT
  USING (profile_id = auth.uid());

-- Users can insert their own insights (client-side computation)
CREATE POLICY "guardrail_insights_own_insert"
  ON ai_guardrail_insights FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_guardrail_insights_profile
  ON ai_guardrail_insights (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardrail_insights_type
  ON ai_guardrail_insights (profile_id, insight_type, created_at DESC);

-- ─── Phase 2.5.2 Feature Flags ───────────────────────────

INSERT INTO feature_flags (gym_id, profile_id, key, enabled) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_machine_alternatives', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_form_checklist', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_guardrails', true)
ON CONFLICT DO NOTHING;
