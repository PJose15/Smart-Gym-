-- ============================================================
-- Migration 029: Agent dedup indexes + pg_cron schedules
-- ============================================================
--
-- Purpose:
--   1. Two partial indexes on smartgym_agent_logs for sub-millisecond
--      cooldown dedup queries (added in plan 05-02 of Phase 5).
--   2. Two pg_cron schedules for the upcoming agent cron routes
--      (built in plans 05-04/05-05 of Phase 5).
--
-- Notes:
--   - The cron routes /api/cron/agent-daily and /api/cron/agent-weekly
--     are created in plans 05-04/05-05. Until those routes deploy, the
--     scheduled net.http_post calls will 404 harmlessly — no data loss.
--   - is_agent_initiated lives in the payload jsonb column on
--     smartgym_agent_logs; no column migration is needed for it.
--     The field is enforced at the application layer (trigger route schema).
--   - Uses gen_random_uuid() convention if any DDL required it (none here).
-- ============================================================

-- ============================================================
-- Partial indexes for cooldown dedup queries (AGENT-02)
-- ============================================================

-- Index for per-(gym, agent, event) dedup window queries:
--   SELECT id FROM smartgym_agent_logs
--   WHERE gym_id = $1 AND agent_name = $2 AND trigger_event = $3
--     AND status = 'sent' AND executed_at >= $windowStart
--   LIMIT 1;
CREATE INDEX IF NOT EXISTS idx_agent_logs_dedup
  ON smartgym_agent_logs(gym_id, agent_name, trigger_event, executed_at DESC)
  WHERE status = 'sent';

-- Index for per-(gym, agent, member) dedup queries
-- (used by at-risk + dormant retention scenarios where member_id matters):
--   SELECT id FROM smartgym_agent_logs
--   WHERE gym_id = $1 AND agent_name = $2 AND member_id = $3
--     AND status = 'sent' AND executed_at >= $windowStart
--   LIMIT 1;
CREATE INDEX IF NOT EXISTS idx_agent_logs_member_dedup
  ON smartgym_agent_logs(gym_id, agent_name, member_id, executed_at DESC)
  WHERE member_id IS NOT NULL AND status = 'sent';

-- ============================================================
-- pg_cron: Daily agent scans (daily 06:00 UTC)
-- Covers: dormant-members, machine-underutilization, checkin-SLA-overdue,
--         challenge auto-expiry (all built in plan 05-04)
-- ============================================================
SELECT cron.schedule(
  'nexera-agent-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/agent-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);

-- ============================================================
-- pg_cron: Weekly agent scans (Sunday 05:00 UTC)
-- Covers: weekly-summary, churn-risk-alert (both built in plan 05-05)
-- ============================================================
SELECT cron.schedule(
  'nexera-agent-weekly',
  '0 5 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/agent-weekly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
