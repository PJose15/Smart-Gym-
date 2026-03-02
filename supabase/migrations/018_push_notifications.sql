-- ============================================================
-- Phase 5.1: Push Notifications Infrastructure
-- ============================================================

-- ─── device_tokens ────────────────────────────────────────
-- Stores Expo push tokens per user per device.

CREATE TABLE device_tokens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token   TEXT        NOT NULL,
  platform          TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id         TEXT,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_device_tokens_profile_token
  ON device_tokens(profile_id, expo_push_token);

CREATE INDEX idx_device_tokens_active
  ON device_tokens(profile_id) WHERE active = true;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_tokens_select ON device_tokens
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY device_tokens_insert ON device_tokens
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY device_tokens_update ON device_tokens
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY device_tokens_delete ON device_tokens
  FOR DELETE USING (profile_id = auth.uid());

-- ─── notification_preferences ─────────────────────────────
-- Simple on/off toggle per user (expandable later).

CREATE TABLE notification_preferences (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  enabled           BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_prefs_select ON notification_preferences
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY notification_prefs_insert ON notification_preferences
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY notification_prefs_update ON notification_preferences
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ─── notification_log ─────────────────────────────────────
-- Audit trail of sent notifications.

CREATE TABLE notification_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  body              TEXT        NOT NULL,
  data              JSONB       DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered')),
  expo_receipt_id   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_profile
  ON notification_log(profile_id, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_log_select ON notification_log
  FOR SELECT USING (profile_id = auth.uid());
