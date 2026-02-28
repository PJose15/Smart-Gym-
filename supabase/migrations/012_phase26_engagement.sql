-- ============================================================
-- Phase 2.6: Engagement — Streaks, Leaderboards, Charts
-- ============================================================

-- ─── Leaderboard RPC Function ──────────────────────────────
-- Returns profile_id and total_points for a gym, optionally
-- filtered by a start date (for weekly leaderboards).

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_gym_id UUID,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(profile_id UUID, total_points BIGINT) AS $$
  SELECT pl.profile_id, SUM(pl.points)::BIGINT AS total_points
  FROM public.points_ledger pl
  WHERE pl.gym_id = p_gym_id
    AND (p_since IS NULL OR pl.created_at >= p_since)
  GROUP BY pl.profile_id
  ORDER BY total_points DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ─── Performance Index for Leaderboard ─────────────────────

CREATE INDEX IF NOT EXISTS idx_points_ledger_gym_profile_created
  ON points_ledger (gym_id, profile_id, created_at);
