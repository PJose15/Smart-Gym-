-- ============================================================
-- Migration 021: Schema alignment
-- Aligns database tables with TypeScript types (database.ts)
-- so all Supabase queries work at runtime.
--
-- Part A: Compatibility views (name mismatches)
-- Part B: New tables (missing from migrations)
-- Part C: Column additions to existing tables
-- ============================================================

-- ============================================================
-- PART A: COMPATIBILITY VIEWS
-- ============================================================

-- A1. profiles → VIEW on users
-- Code queries .from('profiles') but actual table is 'users'
-- Auto-updatable: single table, simple column refs
CREATE OR REPLACE VIEW profiles AS
SELECT
  id,
  email,
  display_name AS full_name,
  avatar_url,
  created_at
FROM users;

-- A2. gym_members → VIEW on members
-- Code queries .from('gym_members') but actual table is 'members'
-- Maps user_id → profile_id for code compatibility
CREATE OR REPLACE VIEW gym_members AS
SELECT
  id,
  gym_id,
  user_id AS profile_id,
  smartgym_score,
  onboarding_status,
  joined_gym_at AS joined_at,
  created_at
FROM members;

-- ============================================================
-- PART B: NEW TABLES
-- ============================================================

-- B1. workouts — Overall workout tracking (gym visit)
-- Different from workout_sessions (which tracks per-machine logs)
CREATE TABLE IF NOT EXISTS workouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workouts_profile ON workouts(profile_id);
CREATE INDEX IF NOT EXISTS idx_workouts_gym ON workouts(gym_id);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workouts_own" ON workouts FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "workouts_service" ON workouts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B2. workout_exercises — Exercises within a workout
CREATE TABLE IF NOT EXISTS workout_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id    uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  machine_id    uuid REFERENCES machines(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_exercises_own" ON workout_exercises FOR ALL
  USING (workout_id IN (SELECT id FROM workouts WHERE profile_id = auth.uid()))
  WITH CHECK (workout_id IN (SELECT id FROM workouts WHERE profile_id = auth.uid()));
CREATE POLICY "workout_exercises_service" ON workout_exercises FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B3. workout_sets — Sets within an exercise
CREATE TABLE IF NOT EXISTS workout_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number          integer NOT NULL,
  weight_kg           numeric(8,2) NOT NULL DEFAULT 0,
  reps                integer NOT NULL DEFAULT 0,
  rpe                 numeric(3,1),
  notes               text,
  logged_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(workout_exercise_id);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_sets_own" ON workout_sets FOR ALL
  USING (workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.profile_id = auth.uid()
  ))
  WITH CHECK (workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.profile_id = auth.uid()
  ));
CREATE POLICY "workout_sets_service" ON workout_sets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sets VIEW — code calls .from('sets')
CREATE OR REPLACE VIEW sets AS
SELECT * FROM workout_sets;

-- B4. user_training_profiles — Training preferences
CREATE TABLE IF NOT EXISTS user_training_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal              text DEFAULT 'general'
    CHECK (goal IN ('strength', 'hypertrophy', 'endurance', 'general')),
  experience        text DEFAULT 'beginner'
    CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  units             text DEFAULT 'kg'
    CHECK (units IN ('kg', 'lbs')),
  preferred_rep_min integer,
  preferred_rep_max integer,
  limitations       text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gym_id, profile_id)
);

CREATE TRIGGER user_training_profiles_updated_at
  BEFORE UPDATE ON user_training_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_training_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "utp_own" ON user_training_profiles FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "utp_service" ON user_training_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B5. points_ledger — Gamification points log
CREATE TABLE IF NOT EXISTS points_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points        integer NOT NULL,
  reason        text NOT NULL,
  reference_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_profile ON points_ledger(profile_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_gym ON points_ledger(gym_id);

ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_own" ON points_ledger FOR SELECT
  USING (profile_id = auth.uid());
CREATE POLICY "points_service" ON points_ledger FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B6. app_events — Analytics events
CREATE TABLE IF NOT EXISTS app_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid REFERENCES gyms(id) ON DELETE SET NULL,
  profile_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  event_name  text NOT NULL,
  event_props jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at);
CREATE INDEX IF NOT EXISTS idx_app_events_name ON app_events(event_name);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_service" ON app_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "events_own_insert" ON app_events FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- B7. set_feedback — Body area feedback per set
CREATE TABLE IF NOT EXISTS set_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id          uuid REFERENCES workouts(id) ON DELETE SET NULL,
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  set_id              uuid REFERENCES workout_sets(id) ON DELETE SET NULL,
  feedback            text NOT NULL,
  body_area           text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_set_feedback_profile ON set_feedback(profile_id);

ALTER TABLE set_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_own" ON set_feedback FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "feedback_service" ON set_feedback FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B8. ai_guardrail_insights — AI safety guardrail results
CREATE TABLE IF NOT EXISTS ai_guardrail_insights (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type        text NOT NULL,
  severity            text NOT NULL,
  confidence          numeric(5,2) NOT NULL DEFAULT 0,
  message             text NOT NULL,
  recommended_action  text NOT NULL,
  meta                jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_guardrail_insights_profile ON ai_guardrail_insights(profile_id);

ALTER TABLE ai_guardrail_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights_own" ON ai_guardrail_insights FOR SELECT
  USING (profile_id = auth.uid());
CREATE POLICY "insights_service" ON ai_guardrail_insights FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B9. guardrail_acknowledgements — User ack of guardrail warnings
CREATE TABLE IF NOT EXISTS guardrail_acknowledgements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type    text NOT NULL,
  severity        text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guardrail_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack_own" ON guardrail_acknowledgements FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "ack_service" ON guardrail_acknowledgements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B10. coach_notes — Coach/trainer notes to members
CREATE TABLE IF NOT EXISTS coach_notes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_profile_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source               text NOT NULL
    CHECK (source IN ('workout', 'weekly', 'manual')),
  status               text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'archived')),
  title                text NOT NULL,
  body                 text NOT NULL,
  meta                 jsonb DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coach_notes_trainer ON coach_notes(trainer_profile_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_member ON coach_notes(member_profile_id);

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_trainer" ON coach_notes FOR ALL
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid());
CREATE POLICY "notes_member_read" ON coach_notes FOR SELECT
  USING (member_profile_id = auth.uid() AND status = 'sent');
CREATE POLICY "notes_service" ON coach_notes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B11. coach_note_drafts — AI-generated draft notes
CREATE TABLE IF NOT EXISTS coach_note_drafts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_profile_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id           uuid REFERENCES workouts(id) ON DELETE SET NULL,
  period_start         date,
  period_end           date,
  draft_title          text NOT NULL,
  draft_body           text NOT NULL,
  confidence           numeric(5,2) NOT NULL DEFAULT 0,
  signals              jsonb DEFAULT '{}',
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'discarded')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER coach_note_drafts_updated_at
  BEFORE UPDATE ON coach_note_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE coach_note_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drafts_trainer" ON coach_note_drafts FOR ALL
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid());
CREATE POLICY "drafts_service" ON coach_note_drafts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B12. coach_note_actions — Action log on notes
CREATE TABLE IF NOT EXISTS coach_note_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  draft_id          uuid REFERENCES coach_note_drafts(id) ON DELETE SET NULL,
  note_id           uuid REFERENCES coach_notes(id) ON DELETE SET NULL,
  actor_profile_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action            text NOT NULL
    CHECK (action IN ('generated', 'edited', 'approved', 'sent', 'discarded')),
  meta              jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_note_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions_own" ON coach_note_actions FOR ALL
  USING (actor_profile_id = auth.uid())
  WITH CHECK (actor_profile_id = auth.uid());
CREATE POLICY "actions_service" ON coach_note_actions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B13. member_note_ack — Member acknowledgment of notes
CREATE TABLE IF NOT EXISTS member_note_ack (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid NOT NULL REFERENCES coach_notes(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, profile_id)
);

ALTER TABLE member_note_ack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack_own_member" ON member_note_ack FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "ack_service_member" ON member_note_ack FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B14. trainer_assignments — Trainer-member pairings
CREATE TABLE IF NOT EXISTS trainer_assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_profile_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_trainer ON trainer_assignments(trainer_profile_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_member ON trainer_assignments(member_profile_id);

ALTER TABLE trainer_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_trainer" ON trainer_assignments FOR ALL
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid());
CREATE POLICY "ta_member_read" ON trainer_assignments FOR SELECT
  USING (member_profile_id = auth.uid());
CREATE POLICY "ta_service" ON trainer_assignments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B15. trainer_style_settings — Trainer personalization
CREATE TABLE IF NOT EXISTS trainer_style_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tone                 text NOT NULL DEFAULT 'supportive'
    CHECK (tone IN ('strict', 'supportive', 'neutral')),
  verbosity            text NOT NULL DEFAULT 'standard'
    CHECK (verbosity IN ('short', 'standard', 'detailed')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gym_id, trainer_profile_id)
);

CREATE TRIGGER trainer_style_settings_updated_at
  BEFORE UPDATE ON trainer_style_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trainer_style_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tss_own" ON trainer_style_settings FOR ALL
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid());
CREATE POLICY "tss_service" ON trainer_style_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- B16. feedback_discomfort_summary — Aggregated discomfort data
CREATE TABLE IF NOT EXISTS feedback_discomfort_summary (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discomfort_count_7d  integer NOT NULL DEFAULT 0,
  top_body_areas_7d    text[] NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discomfort_summary_profile ON feedback_discomfort_summary(profile_id);

ALTER TABLE feedback_discomfort_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discomfort_own" ON feedback_discomfort_summary FOR SELECT
  USING (profile_id = auth.uid());
CREATE POLICY "discomfort_service" ON feedback_discomfort_summary FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- PART C: COLUMN ADDITIONS TO EXISTING TABLES
-- ============================================================

-- C1. notification_preferences: add global 'enabled' toggle
-- Code expects .select('enabled') and .upsert({ enabled: true/false })
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- C2. member_program_assignments: add 'status' column
-- Code filters .eq('status', 'active')
ALTER TABLE member_program_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed'));
