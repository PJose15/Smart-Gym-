-- ============================================================
-- Phase 3: Add missing DELETE policies for workouts and sets
-- ============================================================

-- Members can delete their own workouts (e.g., cancel an empty workout)
CREATE POLICY "workouts_delete_own" ON workouts
  FOR DELETE USING (profile_id = auth.uid());

-- Members can delete their own workout exercises
CREATE POLICY "workout_exercises_delete" ON workout_exercises
  FOR DELETE USING (
    workout_id IN (SELECT id FROM workouts WHERE profile_id = auth.uid())
  );

-- Members can delete their own sets
CREATE POLICY "sets_delete" ON sets
  FOR DELETE USING (
    workout_exercise_id IN (
      SELECT we.id FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.profile_id = auth.uid()
    )
  );
