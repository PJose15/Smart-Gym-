-- ============================================================================
-- Migration 010: Performance DNA Tables
-- Phase 8.5 — Performance DNA (DOC_27)
-- ============================================================================

-- ============================================================
-- MEMBER DNA CACHE
-- Current DNA scores for quick retrieval
-- One row per member (UNIQUE on member_id)
-- Refreshed weekly or after program completion
-- ============================================================
CREATE TABLE member_dna_cache (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Current scores (0-100)
  power_score           integer NOT NULL DEFAULT 0
    CHECK (power_score BETWEEN 0 AND 100),
  consistency_score     integer NOT NULL DEFAULT 0
    CHECK (consistency_score BETWEEN 0 AND 100),
  progression_score     integer NOT NULL DEFAULT 0
    CHECK (progression_score BETWEEN 0 AND 100),
  balance_score         integer NOT NULL DEFAULT 0
    CHECK (balance_score BETWEEN 0 AND 100),
  mindset_score         integer NOT NULL DEFAULT 0
    CHECK (mindset_score BETWEEN 0 AND 100),

  -- Archetype
  archetype_id          text NOT NULL DEFAULT 'newcomer',
  archetype_changed     boolean NOT NULL DEFAULT false,
  previous_archetype_id text,

  -- State
  is_building           boolean NOT NULL DEFAULT true,
  sessions_logged       integer NOT NULL DEFAULT 0,
  distinct_machines     integer NOT NULL DEFAULT 0,

  -- Full result JSON for UI
  result_json           jsonb NOT NULL DEFAULT '{}',
  signals_json          jsonb NOT NULL DEFAULT '{}',

  computed_at           timestamptz NOT NULL DEFAULT now(),
  last_full_compute     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dna_cache_member
  ON member_dna_cache(member_id);

CREATE INDEX idx_dna_cache_gym
  ON member_dna_cache(gym_id);

-- ============================================================
-- MEMBER DNA SNAPSHOTS
-- Weekly snapshots for historical DNA chart
-- One record per member per week
-- ============================================================
CREATE TABLE member_dna_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  snapshot_date         date NOT NULL,

  power_score           integer NOT NULL DEFAULT 0,
  consistency_score     integer NOT NULL DEFAULT 0,
  progression_score     integer NOT NULL DEFAULT 0,
  balance_score         integer NOT NULL DEFAULT 0,
  mindset_score         integer NOT NULL DEFAULT 0,

  archetype_id          text NOT NULL DEFAULT 'newcomer',
  avg_score             integer GENERATED ALWAYS AS (
    (power_score + consistency_score + progression_score +
     balance_score + mindset_score) / 5
  ) STORED,

  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, snapshot_date)
);

CREATE INDEX idx_dna_snapshots_member_date
  ON member_dna_snapshots(member_id, snapshot_date DESC);

CREATE INDEX idx_dna_snapshots_gym_archetype
  ON member_dna_snapshots(gym_id, archetype_id, snapshot_date DESC);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE member_dna_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_dna_snapshots ENABLE ROW LEVEL SECURITY;

-- DNA cache: member can read own
CREATE POLICY "dna_cache_own"
  ON member_dna_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- DNA cache: trainer can read assigned members
CREATE POLICY "dna_cache_trainer"
  ON member_dna_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE assigned_trainer_id = auth.uid()
    )
  );

-- DNA cache: owner can read all gym members
CREATE POLICY "dna_cache_owner"
  ON member_dna_cache FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- DNA cache: service role full access
CREATE POLICY "dna_cache_service_all"
  ON member_dna_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DNA snapshots: member can read own
CREATE POLICY "dna_snapshots_own"
  ON member_dna_snapshots FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- DNA snapshots: owner can read gym snapshots
CREATE POLICY "dna_snapshots_owner"
  ON member_dna_snapshots FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- DNA snapshots: service role full access
CREATE POLICY "dna_snapshots_service_all"
  ON member_dna_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- pg_cron: Weekly DNA computation (Sunday 4:30am UTC)
-- ============================================================
SELECT cron.schedule(
  'nexera-compute-weekly-dna',
  '30 4 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/dna-recompute',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Clean old snapshots — keep 365 days
SELECT cron.schedule(
  'nexera-clean-dna-snapshots',
  '0 8 * * 0',
  $$DELETE FROM member_dna_snapshots WHERE snapshot_date < CURRENT_DATE - 365$$
);
