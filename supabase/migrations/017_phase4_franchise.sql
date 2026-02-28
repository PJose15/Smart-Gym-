-- ============================================================
-- Phase 4.3: Multi-Gym Franchise Dashboard
-- ============================================================

-- ─── franchises table ───────────────────────────────────────

CREATE TABLE franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY franchises_all ON franchises
  FOR ALL USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid());

-- ─── franchise_gyms table ───────────────────────────────────

CREATE TABLE franchise_gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id, gym_id)
);

ALTER TABLE franchise_gyms ENABLE ROW LEVEL SECURITY;

-- SELECT: franchise owner
CREATE POLICY franchise_gyms_select ON franchise_gyms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM franchises f
      WHERE f.id = franchise_gyms.franchise_id
        AND f.owner_profile_id = auth.uid()
    )
  );

-- INSERT: franchise owner who also owns the gym
CREATE POLICY franchise_gyms_insert ON franchise_gyms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM franchises f
      WHERE f.id = franchise_gyms.franchise_id
        AND f.owner_profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM gym_members gm
      WHERE gm.gym_id = franchise_gyms.gym_id
        AND gm.profile_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

-- DELETE: franchise owner
CREATE POLICY franchise_gyms_delete ON franchise_gyms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM franchises f
      WHERE f.id = franchise_gyms.franchise_id
        AND f.owner_profile_id = auth.uid()
    )
  );

-- ─── RPC: get_franchise_overview ────────────────────────────
-- Returns per-gym stats for a franchise.

CREATE OR REPLACE FUNCTION get_franchise_overview(p_franchise_id UUID)
RETURNS TABLE(
  gym_id UUID,
  gym_name TEXT,
  total_members BIGINT,
  total_machines BIGINT,
  workouts_7d BIGINT,
  workouts_30d BIGINT,
  active_members_7d BIGINT
) AS $$
  SELECT
    g.id AS gym_id,
    g.name AS gym_name,
    (SELECT COUNT(*) FROM gym_members gm WHERE gm.gym_id = g.id)::BIGINT AS total_members,
    (SELECT COUNT(*) FROM machines m WHERE m.gym_id = g.id)::BIGINT AS total_machines,
    (SELECT COUNT(*) FROM workouts w
     WHERE w.gym_id = g.id AND w.status = 'completed'
       AND w.started_at >= now() - INTERVAL '7 days')::BIGINT AS workouts_7d,
    (SELECT COUNT(*) FROM workouts w
     WHERE w.gym_id = g.id AND w.status = 'completed'
       AND w.started_at >= now() - INTERVAL '30 days')::BIGINT AS workouts_30d,
    (SELECT COUNT(DISTINCT w.profile_id) FROM workouts w
     WHERE w.gym_id = g.id AND w.status = 'completed'
       AND w.started_at >= now() - INTERVAL '7 days')::BIGINT AS active_members_7d
  FROM franchise_gyms fg
  JOIN gyms g ON g.id = fg.gym_id
  WHERE fg.franchise_id = p_franchise_id
  ORDER BY g.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ─── RPC: get_franchise_totals ──────────────────────────────
-- Returns aggregated totals across all gyms in a franchise.

CREATE OR REPLACE FUNCTION get_franchise_totals(p_franchise_id UUID)
RETURNS TABLE(
  total_gyms BIGINT,
  total_members BIGINT,
  total_machines BIGINT,
  total_workouts_7d BIGINT,
  total_workouts_30d BIGINT,
  total_active_members_7d BIGINT
) AS $$
  SELECT
    COUNT(DISTINCT fg.gym_id)::BIGINT AS total_gyms,
    COALESCE(SUM(sub.total_members), 0)::BIGINT AS total_members,
    COALESCE(SUM(sub.total_machines), 0)::BIGINT AS total_machines,
    COALESCE(SUM(sub.workouts_7d), 0)::BIGINT AS total_workouts_7d,
    COALESCE(SUM(sub.workouts_30d), 0)::BIGINT AS total_workouts_30d,
    COALESCE(SUM(sub.active_members_7d), 0)::BIGINT AS total_active_members_7d
  FROM franchise_gyms fg
  LEFT JOIN LATERAL (
    SELECT
      (SELECT COUNT(*) FROM gym_members gm WHERE gm.gym_id = fg.gym_id) AS total_members,
      (SELECT COUNT(*) FROM machines m WHERE m.gym_id = fg.gym_id) AS total_machines,
      (SELECT COUNT(*) FROM workouts w
       WHERE w.gym_id = fg.gym_id AND w.status = 'completed'
         AND w.started_at >= now() - INTERVAL '7 days') AS workouts_7d,
      (SELECT COUNT(*) FROM workouts w
       WHERE w.gym_id = fg.gym_id AND w.status = 'completed'
         AND w.started_at >= now() - INTERVAL '30 days') AS workouts_30d,
      (SELECT COUNT(DISTINCT w.profile_id) FROM workouts w
       WHERE w.gym_id = fg.gym_id AND w.status = 'completed'
         AND w.started_at >= now() - INTERVAL '7 days') AS active_members_7d
  ) sub ON true
  WHERE fg.franchise_id = p_franchise_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- (Feature flag 'franchise_dashboard' is managed through the Settings UI)
