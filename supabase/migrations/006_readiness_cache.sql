-- ============================================================================
-- Migration 006: Readiness Score Cache Table
-- Phase 8.1 — Training Readiness Score (DOC_23)
-- ============================================================================

CREATE TABLE member_readiness_cache (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                      uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  cache_date                  date NOT NULL,
  score                       integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  zone                        text NOT NULL
    CHECK (zone IN ('peak','ready','moderate','rest')),
  result_json                 jsonb NOT NULL,
  inputs_json                 jsonb NOT NULL,
  dominant_signal             text,
  last_session_completed_at   timestamptz,
  computed_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, cache_date)
);

CREATE INDEX idx_readiness_cache_member_date
  ON member_readiness_cache(member_id, cache_date DESC);

-- RLS
ALTER TABLE member_readiness_cache ENABLE ROW LEVEL SECURITY;

-- Member can read own readiness
CREATE POLICY "readiness_cache_own"
  ON member_readiness_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Trainer can read assigned members' readiness
CREATE POLICY "readiness_cache_trainer"
  ON member_readiness_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assigned_trainer_id = auth.uid()
    )
  );

-- Owner can read all gym members' readiness
CREATE POLICY "readiness_cache_owner"
  ON member_readiness_cache FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- Service role INSERT/UPDATE/DELETE (no user-facing writes)
CREATE POLICY "readiness_cache_service_all"
  ON member_readiness_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Nightly recompute & cleanup (pg_cron)
-- ============================================================================

-- Cleanup entries older than 90 days (daily at 06:00 UTC)
SELECT cron.schedule(
  'nexera-clean-readiness-cache',
  '0 6 * * *',
  $$DELETE FROM member_readiness_cache WHERE cache_date < CURRENT_DATE - 90$$
);

-- Nightly recompute at midnight Puerto Rico time (04:00 UTC)
-- This calls a Supabase Edge Function or pg_net webhook to recompute scores
-- for all active members. The actual recompute logic lives in the app layer.
SELECT cron.schedule(
  'nexera-nightly-readiness-recompute',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/readiness-recompute',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
