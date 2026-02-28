-- ============================================================
-- Phase 4.2: Occupancy Heatmaps
-- ============================================================

-- ─── Performance index for workout queries ──────────────────

CREATE INDEX IF NOT EXISTS idx_workouts_gym_started
  ON workouts(gym_id, started_at DESC) WHERE status = 'completed';

-- ─── RPC: get_hourly_machine_usage ──────────────────────────
-- Returns session counts bucketed by day_of_week (0=Sun..6=Sat)
-- and hour_of_day (0-23) for completed workouts.

CREATE OR REPLACE FUNCTION get_hourly_machine_usage(
  p_gym_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TABLE(day_of_week INT, hour_of_day INT, session_count BIGINT) AS $$
  SELECT
    EXTRACT(DOW FROM w.started_at)::INT AS day_of_week,
    EXTRACT(HOUR FROM w.started_at)::INT AS hour_of_day,
    COUNT(*)::BIGINT AS session_count
  FROM workouts w
  WHERE w.gym_id = p_gym_id
    AND w.status = 'completed'
    AND w.started_at >= (now() - (p_days || ' days')::INTERVAL)
  GROUP BY day_of_week, hour_of_day
  ORDER BY day_of_week, hour_of_day;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ─── RPC: get_machine_usage_frequency ───────────────────────
-- Returns per-machine session count and unique user count.

CREATE OR REPLACE FUNCTION get_machine_usage_frequency(
  p_gym_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TABLE(machine_id UUID, machine_name TEXT, equipment_type TEXT, session_count BIGINT, unique_users BIGINT) AS $$
  SELECT
    m.id AS machine_id,
    m.name AS machine_name,
    m.equipment_type::TEXT,
    COUNT(DISTINCT we.workout_id)::BIGINT AS session_count,
    COUNT(DISTINCT w.profile_id)::BIGINT AS unique_users
  FROM machines m
  LEFT JOIN workout_exercises we ON we.machine_id = m.id
  LEFT JOIN workouts w ON w.id = we.workout_id
    AND w.gym_id = p_gym_id
    AND w.status = 'completed'
    AND w.started_at >= (now() - (p_days || ' days')::INTERVAL)
  WHERE m.gym_id = p_gym_id
  GROUP BY m.id, m.name, m.equipment_type
  ORDER BY session_count DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- (Feature flag 'occupancy_heatmaps' is managed through the Settings UI)
