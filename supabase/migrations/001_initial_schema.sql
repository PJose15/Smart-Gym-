-- ============================================================
-- SmartGym Initial Schema Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── IDENTITY ───────────────────────────────────────────────

CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE user_role AS ENUM ('owner', 'trainer', 'member');

CREATE TABLE gym_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gym_id, profile_id)
);

CREATE INDEX idx_gym_members_gym ON gym_members(gym_id);
CREATE INDEX idx_gym_members_profile ON gym_members(profile_id);

-- ─── EQUIPMENT ──────────────────────────────────────────────

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qr_slug TEXT NOT NULL UNIQUE,
  target_muscles TEXT[] NOT NULL DEFAULT '{}',
  setup_steps TEXT[] NOT NULL DEFAULT '{}',
  safety_cues TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_machines_gym ON machines(gym_id);
CREATE INDEX idx_machines_qr_slug ON machines(qr_slug);

-- ─── TRAINING ───────────────────────────────────────────────

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_gym ON programs(gym_id);

CREATE TABLE program_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  name TEXT NOT NULL
);

CREATE INDEX idx_program_days_program ON program_days(program_id);

CREATE TABLE program_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  default_sets INT NOT NULL DEFAULT 3,
  default_reps INT NOT NULL DEFAULT 10
);

CREATE INDEX idx_program_exercises_day ON program_exercises(program_day_id);

CREATE TABLE member_program_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, program_id)
);

-- ─── LOGGING ────────────────────────────────────────────────

CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_workouts_profile ON workouts(profile_id);
CREATE INDEX idx_workouts_gym ON workouts(gym_id);

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);

CREATE TABLE sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0,
  rpe NUMERIC(3,1),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sets_workout_exercise ON sets(workout_exercise_id);

-- ─── GAMIFICATION ───────────────────────────────────────────

CREATE TYPE points_reason AS ENUM ('workout_completed', 'set_logged', 'streak_bonus', 'manual');

CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason points_reason NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_ledger_profile ON points_ledger(profile_id);
CREATE INDEX idx_points_ledger_gym ON points_ledger(gym_id);

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────

-- Function to get a user's gym IDs (hardened with explicit search_path)
CREATE OR REPLACE FUNCTION get_my_gym_ids()
RETURNS SETOF UUID AS $$
  SELECT gym_id FROM public.gym_members WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth;

-- Function to check if user has a role in a gym
CREATE OR REPLACE FUNCTION has_gym_role(target_gym_id UUID, allowed_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_members
    WHERE gym_id = target_gym_id
    AND profile_id = auth.uid()
    AND role = ANY(allowed_roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth;

-- ─── PUBLIC RPC: Machine lookup by QR slug (no auth required) ───

-- This allows the core QR scan flow to work without requiring the user
-- to be authenticated or a gym member. Returns limited public fields only.
CREATE OR REPLACE FUNCTION get_machine_by_slug(slug TEXT)
RETURNS TABLE (
  id UUID,
  gym_id UUID,
  name TEXT,
  qr_slug TEXT,
  target_muscles TEXT[],
  setup_steps TEXT[],
  safety_cues TEXT[],
  image_url TEXT,
  gym_name TEXT
) AS $$
  SELECT
    m.id, m.gym_id, m.name, m.qr_slug,
    m.target_muscles, m.setup_steps, m.safety_cues, m.image_url,
    g.name AS gym_name
  FROM public.machines m
  JOIN public.gyms g ON g.id = m.gym_id
  WHERE m.qr_slug = slug
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- ─── AUTH TRIGGER: Auto-create profile on signup ───────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gyms_updated_at BEFORE UPDATE ON gyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_machines_updated_at BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
