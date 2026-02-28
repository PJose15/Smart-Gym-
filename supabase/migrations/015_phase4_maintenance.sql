-- ============================================================
-- Phase 4.1: Equipment Maintenance Alerts
-- ============================================================

-- ─── New columns on machines ────────────────────────────────

ALTER TABLE machines ADD COLUMN maintenance_interval_days INT NOT NULL DEFAULT 90;
ALTER TABLE machines ADD COLUMN last_maintained_at TIMESTAMPTZ;
ALTER TABLE machines ADD COLUMN maintenance_status TEXT NOT NULL DEFAULT 'ok'
  CHECK (maintenance_status IN ('ok', 'due_soon', 'overdue', 'in_maintenance'));

-- ─── maintenance_logs table ─────────────────────────────────

CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_logs_machine
  ON maintenance_logs(machine_id, performed_at DESC);

CREATE INDEX idx_maintenance_logs_gym
  ON maintenance_logs(gym_id);

-- ─── RLS for maintenance_logs ───────────────────────────────

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: any gym member can view
CREATE POLICY maintenance_logs_select ON maintenance_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gym_members gm
      WHERE gm.gym_id = maintenance_logs.gym_id
        AND gm.profile_id = auth.uid()
    )
  );

-- INSERT: owner or trainer
CREATE POLICY maintenance_logs_insert ON maintenance_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM gym_members gm
      WHERE gm.gym_id = maintenance_logs.gym_id
        AND gm.profile_id = auth.uid()
        AND gm.role IN ('owner', 'trainer')
    )
  );

-- DELETE: owner only
CREATE POLICY maintenance_logs_delete ON maintenance_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM gym_members gm
      WHERE gm.gym_id = maintenance_logs.gym_id
        AND gm.profile_id = auth.uid()
        AND gm.role = 'owner'
    )
  );

-- ─── RPC: get_maintenance_overview ──────────────────────────

CREATE OR REPLACE FUNCTION get_maintenance_overview(p_gym_id UUID)
RETURNS TABLE(
  machine_id UUID,
  machine_name TEXT,
  equipment_type TEXT,
  maintenance_status TEXT,
  maintenance_interval_days INT,
  last_maintained_at TIMESTAMPTZ,
  days_since_maintenance INT,
  usage_since_maintenance BIGINT
) AS $$
  SELECT
    m.id AS machine_id,
    m.name AS machine_name,
    m.equipment_type::TEXT,
    m.maintenance_status,
    m.maintenance_interval_days,
    m.last_maintained_at,
    COALESCE(
      EXTRACT(DAY FROM (now() - m.last_maintained_at))::INT,
      EXTRACT(DAY FROM (now() - m.created_at))::INT
    ) AS days_since_maintenance,
    COALESCE(
      (SELECT COUNT(*)
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.machine_id = m.id
         AND w.gym_id = p_gym_id
         AND w.status = 'completed'
         AND w.started_at > COALESCE(m.last_maintained_at, m.created_at)
      ), 0
    ) AS usage_since_maintenance
  FROM machines m
  WHERE m.gym_id = p_gym_id
  ORDER BY
    CASE m.maintenance_status
      WHEN 'overdue' THEN 0
      WHEN 'due_soon' THEN 1
      WHEN 'in_maintenance' THEN 2
      ELSE 3
    END,
    days_since_maintenance DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ─── Feature flag seed ──────────────────────────────────────

-- (Feature flag 'maintenance_alerts' is managed through the Settings UI)
