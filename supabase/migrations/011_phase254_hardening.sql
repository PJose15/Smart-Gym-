-- ============================================================
-- Phase 2.5.4 — DB Hardening
-- Constraints, indexes, new tables, RLS, views, feature flags
-- ============================================================

-- ─── A) MISSING CONSTRAINTS ──────────────────────────────────

-- Composite unique on machines(gym_id, qr_slug)
-- (global UNIQUE on qr_slug from 001 stays; this adds multi-gym safety)
ALTER TABLE machines
  ADD CONSTRAINT uq_machines_gym_qr_slug UNIQUE (gym_id, qr_slug);

-- Idempotent set feedback: one feedback record per set per user
ALTER TABLE set_feedback
  ADD CONSTRAINT uq_set_feedback_set_profile UNIQUE (set_id, profile_id);

-- ─── B) MISSING INDEXES ─────────────────────────────────────

-- Fast lookup: most recent completed workout per member
CREATE INDEX IF NOT EXISTS idx_workouts_profile_finished
  ON workouts (profile_id, finished_at DESC);

-- Fast lookup: exercises by workout + machine (for alternatives swap)
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_machine
  ON workout_exercises (workout_id, machine_id);

-- ─── C) NEW TABLE: guardrail_acknowledgements ────────────────
-- Tracks when a user acknowledges a guardrail alert.
-- Cooldown logic: same insight_type acknowledged within 24h = suppress.

CREATE TABLE IF NOT EXISTS guardrail_acknowledgements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type    TEXT NOT NULL
                  CHECK (insight_type IN ('volume_spike', 'high_rpe', 'rep_collapse', 'recovery_overlap')),
  severity        TEXT NOT NULL
                  CHECK (severity IN ('low', 'medium', 'high')),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_ack_profile
  ON guardrail_acknowledgements (profile_id, insight_type, acknowledged_at DESC);

ALTER TABLE guardrail_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Members insert and read their own acknowledgements
CREATE POLICY "guardrail_ack_insert_own"
  ON guardrail_acknowledgements FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "guardrail_ack_select_own"
  ON guardrail_acknowledgements FOR SELECT
  USING (profile_id = auth.uid());

-- Staff (trainers/owners) can read gym members' acknowledgements
CREATE POLICY "guardrail_ack_select_staff"
  ON guardrail_acknowledgements FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- ─── D) NEW TABLE: trainer_style_settings ────────────────────
-- Trainer preferences for coach note tone and verbosity.

CREATE TABLE IF NOT EXISTS trainer_style_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tone                TEXT NOT NULL DEFAULT 'supportive'
                      CHECK (tone IN ('strict', 'supportive', 'neutral')),
  verbosity           TEXT NOT NULL DEFAULT 'standard'
                      CHECK (verbosity IN ('short', 'standard', 'detailed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_trainer_style UNIQUE (gym_id, trainer_profile_id)
);

ALTER TABLE trainer_style_settings ENABLE ROW LEVEL SECURITY;

-- Trainers manage their own style settings
CREATE POLICY "trainer_style_select_own"
  ON trainer_style_settings FOR SELECT
  USING (trainer_profile_id = auth.uid());

CREATE POLICY "trainer_style_insert_own"
  ON trainer_style_settings FOR INSERT
  WITH CHECK (
    trainer_profile_id = auth.uid()
    AND has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );

CREATE POLICY "trainer_style_update_own"
  ON trainer_style_settings FOR UPDATE
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid());

-- Owners can read all style settings in their gym
CREATE POLICY "trainer_style_select_owner"
  ON trainer_style_settings FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

-- Auto-update updated_at
CREATE TRIGGER trg_trainer_style_updated_at
  BEFORE UPDATE ON trainer_style_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── E) NEW TABLE: member_note_ack ──────────────────────────
-- Tracks when a member acknowledges ("Got it") a coach note.

CREATE TABLE IF NOT EXISTS member_note_ack (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         UUID NOT NULL REFERENCES coach_notes(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_note_ack UNIQUE (note_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_member_note_ack_note
  ON member_note_ack (note_id);

ALTER TABLE member_note_ack ENABLE ROW LEVEL SECURITY;

-- Members insert and read their own acknowledgements
CREATE POLICY "member_note_ack_insert_own"
  ON member_note_ack FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "member_note_ack_select_own"
  ON member_note_ack FOR SELECT
  USING (profile_id = auth.uid());

-- Staff can read acknowledgements for notes in their gym
CREATE POLICY "member_note_ack_select_staff"
  ON member_note_ack FOR SELECT
  USING (
    note_id IN (
      SELECT cn.id FROM coach_notes cn
      WHERE cn.gym_id IN (SELECT get_my_gym_ids())
    )
  );

-- ─── F) RLS FIX: Staff can read guardrail insights ──────────
-- Trainers/owners need visibility into member guardrail data.

CREATE POLICY "guardrail_insights_select_staff"
  ON ai_guardrail_insights FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- ─── G) SQL VIEW: feedback_discomfort_summary ────────────────
-- Pre-aggregated discomfort/unstable counts per member (last 7 days).
-- Used by web-admin Safety Alerts page and trainer co-pilot drafts.

CREATE OR REPLACE VIEW feedback_discomfort_summary AS
SELECT
  sf.gym_id,
  sf.profile_id,
  p.full_name,
  COUNT(*) FILTER (
    WHERE sf.feedback = 'discomfort'
    AND sf.created_at >= now() - INTERVAL '7 days'
  ) AS discomfort_count_7d,
  COUNT(*) FILTER (
    WHERE sf.feedback = 'unstable'
    AND sf.created_at >= now() - INTERVAL '7 days'
  ) AS unstable_count_7d,
  ARRAY_AGG(DISTINCT sf.body_area) FILTER (
    WHERE sf.feedback = 'discomfort'
    AND sf.body_area IS NOT NULL
    AND sf.created_at >= now() - INTERVAL '7 days'
  ) AS top_body_areas_7d,
  MAX(sf.created_at) FILTER (
    WHERE sf.feedback = 'discomfort'
  ) AS last_discomfort_at
FROM set_feedback sf
JOIN profiles p ON p.id = sf.profile_id
GROUP BY sf.gym_id, sf.profile_id, p.full_name;

-- ─── H) FEATURE FLAGS ───────────────────────────────────────

INSERT INTO feature_flags (gym_id, profile_id, key, enabled) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_session_intent', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_safety_loop', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_busy_swap', true)
ON CONFLICT (gym_id, profile_id, key) DO NOTHING;
