-- Migration 023: RLS policies + updated_at triggers + missing FK indexes
--
-- Background: medium audit (see .planning/nexera-medium-audit.md) found:
--   19 tables with RLS enabled but ZERO policies (data unreachable by
--     authenticated users, service_role only works because it bypasses RLS)
--   8 tables in schema 001 with `updated_at` column but no trigger, plus
--     device_tokens from migration 019
--   6 high-value missing FK indexes that impact hot-path queries
--
-- All policy additions reuse existing helper functions from migration 001:
--   is_gym_owner / is_gym_trainer / is_gym_member / owned_gym_ids /
--   my_member_id / is_super_admin
-- and `update_updated_at_column()` for triggers.
--
-- Strategy for every policy block:
--   * `service_role` always gets `ALL` — backend routes use the service key
--   * authenticated users scoped by the most natural ownership column
--   * no `USING (true)` free-for-alls

-- ============================================================
-- PART 1 — MISSING updated_at TRIGGERS (9 tables)
-- ============================================================

CREATE TRIGGER gym_agent_config_updated_at
  BEFORE UPDATE ON gym_agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER member_settings_updated_at
  BEFORE UPDATE ON member_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gym_challenges_updated_at
  BEFORE UPDATE ON gym_challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER challenge_participants_updated_at
  BEFORE UPDATE ON challenge_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER member_leaderboard_positions_updated_at
  BEFORE UPDATE ON member_leaderboard_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trainer_preferences_updated_at
  BEFORE UPDATE ON trainer_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- PART 2 — RLS POLICIES FOR TABLES WITH ORPHANED RLS
-- ============================================================

-- ── gym_chains (platform-level) ────────────────────────────
CREATE POLICY "gym_chains_service_all"
  ON gym_chains FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "gym_chains_owner_read"
  ON gym_chains FOR SELECT
  USING (owner_id = auth.uid() OR is_super_admin());

-- ── trainer_invitations (gym-scoped) ───────────────────────
CREATE POLICY "trainer_invitations_service_all"
  ON trainer_invitations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "trainer_invitations_owner"
  ON trainer_invitations FOR ALL
  USING (is_gym_owner(gym_id))
  WITH CHECK (is_gym_owner(gym_id));

-- ── gym_agent_config (gym-scoped) ──────────────────────────
CREATE POLICY "gym_agent_config_service_all"
  ON gym_agent_config FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "gym_agent_config_owner"
  ON gym_agent_config FOR ALL
  USING (is_gym_owner(gym_id))
  WITH CHECK (is_gym_owner(gym_id));

-- ── machine_scan_events (member-scoped + gym owner read) ───
CREATE POLICY "machine_scan_events_service_all"
  ON machine_scan_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "machine_scan_events_member_own"
  ON machine_scan_events FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "machine_scan_events_owner_read"
  ON machine_scan_events FOR SELECT
  USING (is_gym_owner(gym_id));

-- ── member_status_log (member/owner read, service write) ──
CREATE POLICY "member_status_log_service_all"
  ON member_status_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "member_status_log_member_read"
  ON member_status_log FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "member_status_log_owner_read"
  ON member_status_log FOR SELECT
  USING (is_gym_owner(gym_id));

-- ── session_overrides (member own + trainer/owner write) ──
CREATE POLICY "session_overrides_service_all"
  ON session_overrides FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "session_overrides_member_read"
  ON session_overrides FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "session_overrides_trainer_write"
  ON session_overrides FOR ALL
  USING (is_gym_trainer(gym_id) OR is_gym_owner(gym_id))
  WITH CHECK (is_gym_trainer(gym_id) OR is_gym_owner(gym_id));

-- ── ai_tip_cache (member own) ──────────────────────────────
CREATE POLICY "ai_tip_cache_service_all"
  ON ai_tip_cache FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "ai_tip_cache_member_read"
  ON ai_tip_cache FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- ── ai_coaching_sessions (member own) ──────────────────────
CREATE POLICY "ai_coaching_sessions_service_all"
  ON ai_coaching_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "ai_coaching_sessions_member"
  ON ai_coaching_sessions FOR ALL
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "ai_coaching_sessions_owner_read"
  ON ai_coaching_sessions FOR SELECT
  USING (is_gym_owner(gym_id));

-- ── smartgym_agent_logs (service + admin read) ─────────────
CREATE POLICY "smartgym_agent_logs_service_all"
  ON smartgym_agent_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "smartgym_agent_logs_admin_read"
  ON smartgym_agent_logs FOR SELECT
  USING (is_super_admin());

CREATE POLICY "smartgym_agent_logs_owner_read"
  ON smartgym_agent_logs FOR SELECT
  USING (gym_id IS NOT NULL AND is_gym_owner(gym_id));

-- ── leaderboard_snapshots (gym members read) ───────────────
CREATE POLICY "leaderboard_snapshots_service_all"
  ON leaderboard_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "leaderboard_snapshots_gym_read"
  ON leaderboard_snapshots FOR SELECT
  USING (is_gym_member(gym_id));

-- ── challenge_teams (gym members read, owner write) ───────
CREATE POLICY "challenge_teams_service_all"
  ON challenge_teams FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "challenge_teams_gym_read"
  ON challenge_teams FOR SELECT
  USING (
    challenge_id IN (
      SELECT id FROM gym_challenges WHERE is_gym_member(gym_id)
    )
  );

CREATE POLICY "challenge_teams_owner_write"
  ON challenge_teams FOR ALL
  USING (
    challenge_id IN (
      SELECT id FROM gym_challenges WHERE gym_id = ANY(owned_gym_ids())
    )
  )
  WITH CHECK (
    challenge_id IN (
      SELECT id FROM gym_challenges WHERE gym_id = ANY(owned_gym_ids())
    )
  );

-- ── challenge_milestone_log (member own + owner read) ─────
CREATE POLICY "challenge_milestone_log_service_all"
  ON challenge_milestone_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "challenge_milestone_log_member_read"
  ON challenge_milestone_log FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "challenge_milestone_log_owner_read"
  ON challenge_milestone_log FOR SELECT
  USING (
    challenge_id IN (
      SELECT id FROM gym_challenges WHERE gym_id = ANY(owned_gym_ids())
    )
  );

-- ── member_spotlight_log (service + gym owner read) ───────
CREATE POLICY "member_spotlight_log_service_all"
  ON member_spotlight_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "member_spotlight_log_owner_read"
  ON member_spotlight_log FOR SELECT
  USING (is_gym_owner(gym_id));

CREATE POLICY "member_spotlight_log_member_read"
  ON member_spotlight_log FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- ── notification_analytics (service + gym owner read) ─────
CREATE POLICY "notification_analytics_service_all"
  ON notification_analytics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "notification_analytics_owner_read"
  ON notification_analytics FOR SELECT
  USING (gym_id IS NOT NULL AND is_gym_owner(gym_id));

-- ── trainer_preferences (trainer own) ─────────────────────
CREATE POLICY "trainer_preferences_service_all"
  ON trainer_preferences FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "trainer_preferences_own"
  ON trainer_preferences FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ── onboarding_events (service + gym owner read) ──────────
CREATE POLICY "onboarding_events_service_all"
  ON onboarding_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "onboarding_events_owner_read"
  ON onboarding_events FOR SELECT
  USING (gym_id IS NOT NULL AND is_gym_owner(gym_id));

CREATE POLICY "onboarding_events_admin_read"
  ON onboarding_events FOR SELECT
  USING (is_super_admin());

-- ── api_performance_log (service + admin read) ────────────
CREATE POLICY "api_performance_log_service_all"
  ON api_performance_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "api_performance_log_admin_read"
  ON api_performance_log FOR SELECT
  USING (is_super_admin());

-- ── gym_profile_views (service + gym owner read) ──────────
CREATE POLICY "gym_profile_views_service_all"
  ON gym_profile_views FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "gym_profile_views_owner_read"
  ON gym_profile_views FOR SELECT
  USING (is_gym_owner(gym_id));

-- ── gym_partner_kit_assets (gym owner CRUD) ───────────────
CREATE POLICY "gym_partner_kit_assets_service_all"
  ON gym_partner_kit_assets FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "gym_partner_kit_assets_owner"
  ON gym_partner_kit_assets FOR ALL
  USING (is_gym_owner(gym_id))
  WITH CHECK (is_gym_owner(gym_id));


-- ============================================================
-- PART 3 — MISSING FK INDEXES (6 high-value)
-- ============================================================

-- Hot path: every push send + every login
CREATE INDEX IF NOT EXISTS idx_device_tokens_profile_active
  ON device_tokens(profile_id, active)
  WHERE active = true;

-- Push delivery history per user
CREATE INDEX IF NOT EXISTS idx_notification_log_profile_created
  ON notification_log(profile_id, created_at DESC);

-- Trainer reads a member's full note history
CREATE INDEX IF NOT EXISTS idx_trainer_notes_member_created
  ON trainer_member_notes(member_id, created_at DESC);

-- Member chat history pulls + owner audit
CREATE INDEX IF NOT EXISTS idx_ai_coaching_member_created
  ON ai_coaching_sessions(member_id, created_at DESC);

-- Member program schedule lookups during scan flow
CREATE INDEX IF NOT EXISTS idx_session_overrides_member_date
  ON session_overrides(member_id, override_date DESC);

-- Member status history (owner dashboard / audit)
CREATE INDEX IF NOT EXISTS idx_member_status_log_member_time
  ON member_status_log(member_id, changed_at DESC);
