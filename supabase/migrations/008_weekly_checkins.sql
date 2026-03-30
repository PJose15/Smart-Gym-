-- ============================================================================
-- Migration 008: Weekly Check-Ins Table
-- Phase 8.3 — Weekly Check-In System (DOC_25)
-- ============================================================================

CREATE TABLE weekly_checkins (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  week_start            date NOT NULL,
  week_end              date NOT NULL,

  -- Message content
  ai_draft              text NOT NULL,
  final_message         text,

  -- Send metadata
  sent_by               text CHECK (sent_by IN ('ai', 'trainer', 'trainer_approved_ai')),
  trainer_approved      boolean NOT NULL DEFAULT false,
  trainer_approved_at   timestamptz,
  sent_at               timestamptz,

  -- Member reply
  member_replied        boolean NOT NULL DEFAULT false,
  reply_text            text,
  replied_at            timestamptz,

  -- Week stats snapshot (for display without re-querying)
  sessions_this_week    integer NOT NULL DEFAULT 0,
  sessions_last_week    integer NOT NULL DEFAULT 0,
  total_volume_lbs      numeric(12,2) NOT NULL DEFAULT 0,
  prs_this_week         integer NOT NULL DEFAULT 0,
  current_streak        integer NOT NULL DEFAULT 0,

  -- Full data snapshot for re-generation if needed
  week_data_snapshot    jsonb NOT NULL DEFAULT '{}',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE(member_id, week_start)
);

-- Updated-at trigger
CREATE TRIGGER weekly_checkins_updated_at
  BEFORE UPDATE ON weekly_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_checkins_member_week
  ON weekly_checkins(member_id, week_start DESC);

CREATE INDEX idx_checkins_trainer_pending
  ON weekly_checkins(trainer_id, trainer_approved, sent_at)
  WHERE trainer_id IS NOT NULL AND trainer_approved = false;

CREATE INDEX idx_checkins_gym_week
  ON weekly_checkins(gym_id, week_start DESC);

-- RLS
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Members see only their own check-ins
CREATE POLICY "checkins_own"
  ON weekly_checkins FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Trainers see check-ins for their assigned members
CREATE POLICY "checkins_trainer"
  ON weekly_checkins FOR ALL
  USING (trainer_id = auth.uid());

-- Owners see all gym check-ins
CREATE POLICY "checkins_owner"
  ON weekly_checkins FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- Service role full access
CREATE POLICY "checkins_service_all"
  ON weekly_checkins FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-clean check-ins older than 1 year (keep replied ones)
-- Runs every Sunday at 07:00 UTC
SELECT cron.schedule(
  'nexera-clean-old-checkins',
  '0 7 * * 0',
  $$DELETE FROM weekly_checkins WHERE week_start < CURRENT_DATE - 365 AND member_replied = false$$
);
