-- Phase 5A: Leaderboard RPC function
-- Returns ranked members by points (all-time) or volume (weekly since p_since)

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_gym_id uuid,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(profile_id uuid, total_points bigint)
LANGUAGE sql STABLE
AS $$
  -- All-time: rank by smartgym_score
  (SELECT
    m.user_id AS profile_id,
    m.smartgym_score::bigint AS total_points
  FROM members m
  WHERE m.gym_id = p_gym_id
    AND m.is_active = true
    AND m.user_id IS NOT NULL
    AND m.smartgym_score > 0
    AND p_since IS NULL
  ORDER BY m.smartgym_score DESC
  LIMIT p_limit)

  UNION ALL

  -- Weekly: rank by total volume since p_since (using session_date)
  (SELECT
    m.user_id AS profile_id,
    COALESCE(SUM(ws.total_volume_lbs), 0)::bigint AS total_points
  FROM members m
  LEFT JOIN workout_sessions ws
    ON ws.member_id = m.id
    AND ws.completed_at IS NOT NULL
    AND ws.session_date >= p_since::date
  WHERE m.gym_id = p_gym_id
    AND m.is_active = true
    AND m.user_id IS NOT NULL
    AND p_since IS NOT NULL
  GROUP BY m.user_id
  HAVING COALESCE(SUM(ws.total_volume_lbs), 0) > 0
  ORDER BY total_points DESC
  LIMIT p_limit);
$$;
