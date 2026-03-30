-- ============================================================================
-- Migration 007: Muscle Map Cache Table
-- Phase 8.2 — Muscle Recovery Visualization (DOC_24)
-- ============================================================================

CREATE TABLE member_muscle_cache (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  cache_date        date NOT NULL,
  muscle_states     jsonb NOT NULL,
  recommendations   jsonb NOT NULL,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, cache_date)
);

CREATE INDEX idx_muscle_cache_member_date
  ON member_muscle_cache(member_id, cache_date DESC);

-- RLS
ALTER TABLE member_muscle_cache ENABLE ROW LEVEL SECURITY;

-- Member can read own muscle map
CREATE POLICY "muscle_cache_own"
  ON member_muscle_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Trainer can read assigned members' muscle map
CREATE POLICY "muscle_cache_trainer"
  ON member_muscle_cache FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assigned_trainer_id = auth.uid()
    )
  );

-- Owner can read all gym members' muscle map
CREATE POLICY "muscle_cache_owner"
  ON member_muscle_cache FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- Service role INSERT/UPDATE/DELETE
CREATE POLICY "muscle_cache_service_all"
  ON member_muscle_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup entries older than 14 days (daily at 06:15 UTC)
SELECT cron.schedule(
  'nexera-clean-muscle-cache',
  '15 6 * * *',
  $$DELETE FROM member_muscle_cache WHERE cache_date < CURRENT_DATE - 14$$
);
