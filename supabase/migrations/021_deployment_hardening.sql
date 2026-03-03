-- 021_deployment_hardening.sql
-- Deployment hardening: constraints, triggers, policies, indexes

-- ─── Issue 3: CHECK constraints on sets and machines ─────────────

ALTER TABLE sets ADD CONSTRAINT chk_sets_reps CHECK (reps > 0);
ALTER TABLE sets ADD CONSTRAINT chk_sets_weight CHECK (weight_kg >= 0);
ALTER TABLE sets ADD CONSTRAINT chk_sets_number CHECK (set_number > 0);
ALTER TABLE sets ADD CONSTRAINT chk_sets_rpe CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10));
ALTER TABLE machines ADD CONSTRAINT chk_maintenance_interval CHECK (maintenance_interval_days > 0);

-- ─── Issue 5: RLS WITH CHECK on coach_note_drafts UPDATE ────────

DROP POLICY IF EXISTS "coach_note_drafts_trainer_update" ON coach_note_drafts;
CREATE POLICY "coach_note_drafts_trainer_update"
  ON coach_note_drafts FOR UPDATE
  USING (trainer_profile_id = auth.uid())
  WITH CHECK (trainer_profile_id = auth.uid() AND gym_id IN (SELECT get_my_gym_ids()));

-- ─── Issue 6: Missing updated_at triggers ───────────────────────

CREATE TRIGGER trg_franchises_updated_at BEFORE UPDATE ON franchises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_device_tokens_updated_at BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Issue 10: maintenance_logs UPDATE policy ───────────────────

CREATE POLICY "maintenance_logs_update" ON maintenance_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM gym_members gm
      WHERE gm.gym_id = maintenance_logs.gym_id
        AND gm.profile_id = auth.uid()
        AND gm.role IN ('owner', 'trainer')
    )
  );

-- ─── Issue 18: Compound index for workout queries ───────────────

CREATE INDEX IF NOT EXISTS idx_workouts_profile_status_started
  ON workouts(profile_id, status, started_at DESC);
