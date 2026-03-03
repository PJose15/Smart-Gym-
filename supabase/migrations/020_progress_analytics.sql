-- ============================================================================
-- 020: Progress Analytics — RPC, Index, Feature Flag
-- ============================================================================

-- Index for exercise_name lookups across all workouts
CREATE INDEX IF NOT EXISTS idx_workout_exercises_name
  ON workout_exercises(exercise_name);

-- RPC: Returns raw sets for a single exercise, scoped to a user and optional date range.
-- The client uses these rows to compute trends, PRs, and strength curves.
CREATE OR REPLACE FUNCTION get_exercise_progression(
  p_profile_id UUID,
  p_exercise_name TEXT,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  workout_id UUID,
  started_at TIMESTAMPTZ,
  set_number INT,
  reps INT,
  weight_kg NUMERIC(6,2),
  rpe NUMERIC(3,1)
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id AS workout_id,
    w.started_at,
    s.set_number,
    s.reps,
    s.weight_kg,
    s.rpe
  FROM sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workouts w ON w.id = we.workout_id
  WHERE w.profile_id = p_profile_id
    AND w.status = 'completed'
    AND we.exercise_name = p_exercise_name
    AND (p_since IS NULL OR w.started_at >= p_since)
  ORDER BY w.started_at ASC, s.set_number ASC;
$$;

-- Feature flag for enhanced progress analytics
INSERT INTO feature_flags (key, enabled)
VALUES ('progress_analytics', true)
ON CONFLICT (key) WHERE profile_id IS NULL DO NOTHING;
