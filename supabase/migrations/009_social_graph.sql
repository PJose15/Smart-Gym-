-- ============================================================================
-- Migration 009: Social Graph Tables
-- Phase 8.4 — Social Graph Additions (DOC_26)
-- ============================================================================

-- Member goals (inspired by feed events / PRs)
CREATE TABLE member_goals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                  uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  goal_type               text NOT NULL
    CHECK (goal_type IN ('beat_pr', 'reach_weight', 'hit_sessions', 'custom')),
  machine_id              uuid REFERENCES machines(id) ON DELETE SET NULL,
  machine_name            text,
  target_weight_lbs       numeric(8,2),
  target_reps             integer,
  target_sessions         integer,
  custom_description      text,
  inspired_by_member_id   uuid REFERENCES members(id) ON DELETE SET NULL,
  inspired_by_event_id    uuid REFERENCES gym_feed_events(id) ON DELETE SET NULL,
  is_achieved             boolean NOT NULL DEFAULT false,
  achieved_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_member_machine
  ON member_goals(member_id, machine_id, is_achieved)
  WHERE is_achieved = false;

CREATE INDEX idx_goals_member_active
  ON member_goals(member_id, is_achieved)
  WHERE is_achieved = false;

ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_own"
  ON member_goals FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "goals_trainer"
  ON member_goals FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assigned_trainer_id = auth.uid()
    )
  );

CREATE POLICY "goals_service_all"
  ON member_goals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Workout share log (one share per member per day)
CREATE TABLE workout_share_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id      uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES gym_feed_events(id) ON DELETE CASCADE,
  shared_at   date NOT NULL,
  status      text NOT NULL DEFAULT 'training'
    CHECK (status IN ('training', 'completed')),
  UNIQUE(member_id, shared_at)
);

ALTER TABLE workout_share_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_log_own"
  ON workout_share_log FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "share_log_service_all"
  ON workout_share_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Goal notification log (one notification per goal)
CREATE TABLE member_goal_notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid NOT NULL REFERENCES member_goals(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(goal_id)
);

ALTER TABLE member_goal_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_notif_service_all"
  ON member_goal_notification_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add demo video columns to machines
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS demo_video_url text,
  ADD COLUMN IF NOT EXISTS demo_video_uploaded_by uuid
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS demo_video_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS preset_key text;

-- Add workout_share to feed event types (ALTER CHECK constraint)
-- Note: 'goal_reached' already exists in the schema
ALTER TABLE gym_feed_events DROP CONSTRAINT IF EXISTS gym_feed_events_event_type_check;
ALTER TABLE gym_feed_events ADD CONSTRAINT gym_feed_events_event_type_check
  CHECK (event_type IN (
    'pr_weight', 'pr_volume', 'streak_milestone',
    'program_complete', 'session_milestone', 'level_up',
    'achievement_earned', 'challenge_launched', 'challenge_joined',
    'challenge_rank_1', 'challenge_podium', 'challenge_complete',
    'member_spotlight', 'gym_announcement', 'new_member', 'goal_reached',
    'workout_share'
  ));

-- Add goalset reaction type
ALTER TABLE feed_reactions DROP CONSTRAINT IF EXISTS feed_reactions_reaction_type_check;
ALTER TABLE feed_reactions ADD CONSTRAINT feed_reactions_reaction_type_check
  CHECK (reaction_type IN ('strength', 'fire', 'champion', 'letsgo', 'goalset'));

-- Cleanup stale workout shares (4 hours, no session logged) — daily at 07:00 UTC
SELECT cron.schedule(
  'nexera-clean-stale-shares',
  '0 7 * * *',
  $$UPDATE gym_feed_events SET priority = 'hidden'
    WHERE event_type = 'workout_share'
    AND created_at < now() - interval '4 hours'
    AND id IN (
      SELECT event_id FROM workout_share_log WHERE status = 'training'
    )$$
);
