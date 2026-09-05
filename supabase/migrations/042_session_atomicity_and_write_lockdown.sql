-- ============================================================
-- Migration 042: Session atomicity + client write lockdown
-- Stage 5 of FIX_PLAN_2026-08-25.
--
-- M-7  : lost-set race — concurrent POST /api/sessions could create
--        duplicate (member, machine, date) rows or drop a set on
--        read-modify-write. Fix: unique index + atomic upsert RPC.
-- M-6  : handled route-side (conditional completed_at update).
-- DB-H3: workout_sessions was client-writable FOR ALL, letting a
--        direct-Supabase writer fabricate is_personal_best /
--        total_volume_lbs. All writers (web scan flow + mobile as of
--        Stage 4b) go through /api/sessions with the service role, so
--        member access becomes SELECT-only.
-- ============================================================

-- ── 1. Dedupe before the unique index (pre-launch test data) ──
-- Keep the row with the most sets (tie: newest) per key.
DELETE FROM workout_sessions ws
USING workout_sessions dup
WHERE ws.member_id = dup.member_id
  AND ws.machine_id = dup.machine_id
  AND ws.session_date = dup.session_date
  AND ws.machine_id IS NOT NULL
  AND ws.id <> dup.id
  AND (ws.sets_count, ws.created_at, ws.id) < (dup.sets_count, dup.created_at, dup.id);

-- ── 2. One session per (member, machine, day) ─────────────────
-- Default NULLS DISTINCT: legacy NULL-machine rows stay unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_member_machine_date
  ON workout_sessions(member_id, machine_id, session_date);

-- ── 3. Atomic set-append RPC (service-role only) ──────────────
CREATE OR REPLACE FUNCTION append_session_set(
  p_member_id    uuid,
  p_gym_id       uuid,
  p_machine_id   uuid,
  p_session_date date,
  p_workout_mode text,
  p_weight_lbs   numeric,
  p_reps         integer,
  p_rpe          numeric DEFAULT NULL,
  p_notes        text DEFAULT NULL
) RETURNS workout_sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row workout_sessions;
BEGIN
  INSERT INTO workout_sessions (
    gym_id, machine_id, member_id, session_date, workout_mode,
    sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps
  )
  VALUES (
    p_gym_id, p_machine_id, p_member_id, p_session_date, p_workout_mode,
    jsonb_build_array(jsonb_build_object(
      'set_number', 1,
      'weight_lbs', p_weight_lbs,
      'reps', p_reps,
      'rpe', p_rpe,
      'notes', p_notes,
      'logged_at', to_jsonb(now())
    )),
    1, p_weight_lbs * p_reps, p_weight_lbs, p_reps
  )
  ON CONFLICT (member_id, machine_id, session_date) DO UPDATE SET
    sets = workout_sessions.sets || jsonb_build_object(
      'set_number', workout_sessions.sets_count + 1,
      'weight_lbs', p_weight_lbs,
      'reps', p_reps,
      'rpe', p_rpe,
      'notes', p_notes,
      'logged_at', to_jsonb(now())
    ),
    sets_count = workout_sessions.sets_count + 1,
    total_volume_lbs = workout_sessions.total_volume_lbs + (p_weight_lbs * p_reps),
    best_weight_lbs = GREATEST(COALESCE(workout_sessions.best_weight_lbs, 0), p_weight_lbs),
    best_reps = CASE
      WHEN p_weight_lbs >= GREATEST(COALESCE(workout_sessions.best_weight_lbs, 0), p_weight_lbs)
        THEN GREATEST(COALESCE(workout_sessions.best_reps, 0), p_reps)
      ELSE COALESCE(workout_sessions.best_reps, p_reps)
    END
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Only the API (service role) may execute — mirrors the 037 lockdown.
REVOKE ALL ON FUNCTION append_session_set(uuid, uuid, uuid, date, text, numeric, integer, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_session_set(uuid, uuid, uuid, date, text, numeric, integer, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION append_session_set(uuid, uuid, uuid, date, text, numeric, integer, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION append_session_set(uuid, uuid, uuid, date, text, numeric, integer, numeric, text) TO service_role;

-- ── 4. DB-H3: members read their sessions, never write them ───
DROP POLICY IF EXISTS "sessions_own" ON workout_sessions;
CREATE POLICY "sessions_own"
  ON workout_sessions FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );
