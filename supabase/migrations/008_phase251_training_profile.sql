-- ============================================================
-- Phase 2.5.1: User Training Profiles + Machine Tags
-- ============================================================

-- ─── User Training Profiles ─────────────────────────────────

CREATE TABLE IF NOT EXISTS user_training_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal            TEXT NOT NULL DEFAULT 'general'
                  CHECK (goal IN ('strength', 'hypertrophy', 'endurance', 'general')),
  experience      TEXT NOT NULL DEFAULT 'beginner'
                  CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  units           TEXT NOT NULL DEFAULT 'lbs'
                  CHECK (units IN ('kg', 'lbs')),
  preferred_rep_min INT,
  preferred_rep_max INT,
  limitations     TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, profile_id),
  CONSTRAINT valid_rep_range CHECK (
    (preferred_rep_min IS NULL AND preferred_rep_max IS NULL)
    OR (preferred_rep_min >= 1 AND preferred_rep_max <= 30 AND preferred_rep_max >= preferred_rep_min)
  )
);

-- Auto-update updated_at
CREATE TRIGGER set_training_profile_updated_at
  BEFORE UPDATE ON user_training_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ─── Machine Tag Columns ────────────────────────────────────

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS movement_pattern TEXT,
  ADD COLUMN IF NOT EXISTS equipment_type   TEXT;

-- ─── RLS ────────────────────────────────────────────────────

ALTER TABLE user_training_profiles ENABLE ROW LEVEL SECURITY;

-- Members can manage their own training profile
CREATE POLICY "training_profile_own_select"
  ON user_training_profiles FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "training_profile_own_insert"
  ON user_training_profiles FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "training_profile_own_update"
  ON user_training_profiles FOR UPDATE
  USING (profile_id = auth.uid());

-- Staff (owner/trainer) can read any profile in their gym(s)
CREATE POLICY "training_profile_staff_read"
  ON user_training_profiles FOR SELECT
  USING (gym_id IN (SELECT get_my_gym_ids()));

-- ─── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_training_profiles_profile
  ON user_training_profiles (profile_id);

CREATE INDEX IF NOT EXISTS idx_training_profiles_gym
  ON user_training_profiles (gym_id);

-- ─── Phase 2.5.1 Feature Flags ─────────────────────────────

INSERT INTO feature_flags (gym_id, profile_id, key, enabled) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'training_profile_enabled', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'why_this_today_enabled',  true)
ON CONFLICT DO NOTHING;
