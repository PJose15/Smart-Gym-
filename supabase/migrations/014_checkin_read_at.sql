-- ============================================================================
-- Migration 014: Check-In Read Tracking (UI_009)
-- Adds read_at column for unread check-in ritual
-- ============================================================================

-- NULL = unread; set to now() when member views the check-in
ALTER TABLE weekly_checkins ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_checkins_member_unread
  ON weekly_checkins(member_id, read_at) WHERE read_at IS NULL;
