-- ============================================================
-- Phase 2.5: AI Assist — schema additions
-- ============================================================

-- ─── MACHINE CUE ENRICHMENT ─────────────────────────────────
ALTER TABLE machines
  ADD COLUMN common_mistakes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN cue_version INT NOT NULL DEFAULT 1,
  ADD COLUMN cue_source TEXT NOT NULL DEFAULT 'manual';

-- Composite index for machine lookup
CREATE INDEX IF NOT EXISTS idx_machines_gym_slug ON machines(gym_id, qr_slug);

-- ─── FEATURE FLAGS ──────────────────────────────────────────
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gym_id, profile_id, key)
);

CREATE INDEX idx_feature_flags_lookup ON feature_flags(gym_id, profile_id, key);

-- RLS for feature_flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Members can read their own flags and gym-level flags
CREATE POLICY "feature_flags_select" ON feature_flags
  FOR SELECT USING (
    -- global flags (null gym_id, null profile_id)
    (gym_id IS NULL AND profile_id IS NULL)
    -- gym-level flags user belongs to
    OR (gym_id IN (SELECT get_my_gym_ids()) AND profile_id IS NULL)
    -- user-specific flags
    OR (profile_id = auth.uid())
  );

-- Only owners/trainers can manage feature flags
CREATE POLICY "feature_flags_insert" ON feature_flags
  FOR INSERT WITH CHECK (
    -- gym-level flags
    (gym_id IS NOT NULL AND has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]))
    -- user-specific flags in gyms they manage
    OR (profile_id IS NOT NULL AND gym_id IS NOT NULL
        AND has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]))
  );

CREATE POLICY "feature_flags_update" ON feature_flags
  FOR UPDATE USING (
    (gym_id IS NOT NULL AND has_gym_role(gym_id, ARRAY['owner']::user_role[]))
  );

CREATE POLICY "feature_flags_delete" ON feature_flags
  FOR DELETE USING (
    (gym_id IS NOT NULL AND has_gym_role(gym_id, ARRAY['owner']::user_role[]))
  );

-- ─── APP EVENTS (Observability) ─────────────────────────────
CREATE TABLE app_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_props JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_events_lookup ON app_events(gym_id, profile_id, event_name, created_at);
CREATE INDEX idx_app_events_name ON app_events(event_name, created_at);

-- RLS for app_events
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- Members can insert their own events
CREATE POLICY "app_events_insert" ON app_events
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
  );

-- Members can read their own events
CREATE POLICY "app_events_select_own" ON app_events
  FOR SELECT USING (profile_id = auth.uid());

-- Staff can read gym events
CREATE POLICY "app_events_select_staff" ON app_events
  FOR SELECT USING (
    gym_id IS NOT NULL
    AND has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );

-- ─── AI AUDIT LOGS ──────────────────────────────────────────
CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  context TEXT NOT NULL,  -- 'next_set' | 'summary' | 'machine_mistakes'
  inputs JSONB NOT NULL DEFAULT '{}',
  outputs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_audit_logs_lookup ON ai_audit_logs(profile_id, context, created_at);
CREATE INDEX idx_ai_audit_logs_gym ON ai_audit_logs(gym_id, context, created_at);

-- RLS for ai_audit_logs
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Members can insert their own audit logs (client-side logging)
CREATE POLICY "ai_audit_logs_insert" ON ai_audit_logs
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Members can read their own audit logs
CREATE POLICY "ai_audit_logs_select_own" ON ai_audit_logs
  FOR SELECT USING (profile_id = auth.uid());

-- Staff can read gym audit logs
CREATE POLICY "ai_audit_logs_select_staff" ON ai_audit_logs
  FOR SELECT USING (
    gym_id IS NOT NULL
    AND has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[])
  );

-- ─── ADDITIONAL INDEXES ─────────────────────────────────────
-- Performance indexes for the AI service layer queries
CREATE INDEX IF NOT EXISTS idx_workouts_profile_started
  ON workouts(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sets_exercise_created
  ON sets(workout_exercise_id, created_at);

-- Update get_machine_by_slug to also return new fields
CREATE OR REPLACE FUNCTION get_machine_by_slug(slug TEXT)
RETURNS TABLE (
  id UUID,
  gym_id UUID,
  name TEXT,
  qr_slug TEXT,
  target_muscles TEXT[],
  setup_steps TEXT[],
  safety_cues TEXT[],
  common_mistakes TEXT[],
  cue_version INT,
  cue_source TEXT,
  image_url TEXT,
  gym_name TEXT
) AS $$
  SELECT
    m.id, m.gym_id, m.name, m.qr_slug,
    m.target_muscles, m.setup_steps, m.safety_cues,
    m.common_mistakes, m.cue_version, m.cue_source,
    m.image_url,
    g.name AS gym_name
  FROM public.machines m
  JOIN public.gyms g ON g.id = m.gym_id
  WHERE m.qr_slug = slug
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;
