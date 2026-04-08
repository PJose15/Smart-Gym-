-- Migration 019: Create missing tables referenced by code
-- ai_audit_logs (edge functions + analytics), device_tokens (push), notification_log (delivery tracking)

-- 1) ai_audit_logs (used by edge function + mobile + analytics page)
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid REFERENCES gyms(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES users(id) ON DELETE SET NULL,
  context    text NOT NULL,
  inputs     jsonb NOT NULL DEFAULT '{}',
  outputs    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON ai_audit_logs(created_at);

ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON ai_audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "admin_read" ON ai_audit_logs FOR SELECT USING (is_super_admin());

-- 2) device_tokens (Expo push tokens for mobile)
CREATE TABLE IF NOT EXISTS device_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform        text CHECK (platform IN ('ios','android','web')),
  active          boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, expo_push_token)
);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_tokens" ON device_tokens FOR ALL USING (auth.uid() = profile_id);
CREATE POLICY "service_role_all_dt" ON device_tokens FOR ALL USING (auth.role() = 'service_role');

-- 3) notification_log (Expo push delivery log)
CREATE TABLE IF NOT EXISTS notification_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL CHECK (status IN ('sent','failed')),
  expo_receipt_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_nl" ON notification_log FOR ALL USING (auth.role() = 'service_role');
