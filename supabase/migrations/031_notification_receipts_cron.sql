-- ============================================================
-- Migration 031: notification_log status CHECK + receipt index + cron
-- ============================================================
--
-- Purpose:
--   1. Extend notification_log.status CHECK to accept 'delivered',
--      aligning the DB constraint with the existing NotificationLog
--      TypeScript type which already declares 'sent' | 'failed' | 'delivered'.
--   2. Add a partial index on notification_log to back the receipt-poll
--      query (pending receipts, recent-first) — avoids full-table scans
--      on the status='sent' + expo_receipt_id IS NOT NULL subset.
--   3. Schedule the nexera-receipt-poll pg_cron job (every 15 minutes)
--      that POSTs to /api/cron/receipt-poll, following the same
--      net.http_post dual-header pattern as migration 029.
--
-- Notes:
--   a. The /api/cron/receipt-poll route is built in plan 06-04. Until that
--      plan deploys, the scheduled net.http_post calls will 404 harmlessly —
--      established pattern from migration 029 (agent-daily/agent-weekly
--      were scheduled before their routes existed).
--   b. No expo_receipt_ids array column is added. The Edge Function stores
--      only the first ticket ID per send (single-receipt MVP). Multi-device
--      receipt coverage is a post-launch improvement. Decision documented in
--      06-RESEARCH.md Pitfall 5.
--   c. 'delivered' aligns the DB CHECK with the NotificationLog TypeScript
--      type (already declared in @nexera/types). The DB was the lagging side.
--   d. notification_log is a service_role-only table (no RLS changes needed).
--   e. Uses gen_random_uuid() convention where UUID generation is required
--      (none in this migration).
-- ============================================================

-- ============================================================
-- 1. Extend status CHECK to include 'delivered'
-- ============================================================
-- Postgres names unnamed CHECK constraints as {table}_{column}_check by
-- default. Migration 019 did not name the constraint, so the default name
-- applies. We drop-if-exists then re-add to keep this idempotent.

ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('sent', 'failed', 'delivered'));

-- ============================================================
-- 2. Partial index: receipt-poll pending receipts, recent-first
-- ============================================================
-- Backs queries of the form:
--   SELECT id, expo_receipt_id FROM notification_log
--   WHERE status = 'sent' AND expo_receipt_id IS NOT NULL
--   ORDER BY created_at DESC
--   LIMIT 100;
-- Only a small fraction of rows are in 'sent' state with a receipt ID —
-- this partial index makes the receipt-poll route O(pending) not O(table).

CREATE INDEX IF NOT EXISTS idx_notification_log_receipt_pending
  ON notification_log(created_at DESC)
  WHERE status = 'sent' AND expo_receipt_id IS NOT NULL;

-- ============================================================
-- 3. pg_cron: Receipt-poll every 15 minutes
-- ============================================================
-- Mirrors the dual-header net.http_post pattern from migration 029
-- (nexera-agent-daily / nexera-agent-weekly). Same auth scheme:
--   Authorization: Bearer <service_role_key>   (verifyMember / cron route)
--   Content-Type: application/json
-- The route validates the Bearer token against SUPABASE_SERVICE_ROLE_KEY.

SELECT cron.schedule(
  'nexera-receipt-poll',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/receipt-poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
