-- ═══════════════════════════════════════════════════════════════════
-- Migration 040: schedule weekly check-in generation + 48h deadline sweep
-- (AUDIT_2026-08-25 Stage 4: AI-C1)
-- ═══════════════════════════════════════════════════════════════════
-- The weekly check-in pipeline was never scheduled: nothing hit
-- /api/agents/checkin-generate or /api/cron/checkin-deadline, so check-ins
-- were never generated and overdue drafts never auto-sent. Add both
-- schedules, matching the pg_cron pattern established in migration 029.
--
-- ⚠️ INFRA REQUIREMENT (applies to ALL http crons, not just these): the
-- net.http_post calls resolve their URL + auth from database GUCs that are
-- currently UNSET on this project, so every http cron (agent-daily/weekly,
-- readiness-recompute, and these) silently no-ops until configured:
--     ALTER DATABASE postgres SET app.settings.base_url = 'https://<prod-url>';
--     ALTER DATABASE postgres SET app.settings.internal_webhook_key = '<INTERNAL_WEBHOOK_KEY>';
--     ALTER DATABASE postgres SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
-- (Secrets — must be set out-of-band by an operator; not embedded in a migration.)
--
-- checkin-generate is per-gym (batches members internally), so the weekly
-- job fans out one POST per active gym. checkin-deadline is gym-agnostic.
-- Both routes authenticate via the x-smartgym-internal-key header.
--
-- Rollback: SELECT cron.unschedule('nexera-checkin-generate');
--           SELECT cron.unschedule('nexera-checkin-deadline');

-- Idempotent: drop any prior schedule of the same name before re-adding.
DO $$ BEGIN PERFORM cron.unschedule('nexera-checkin-generate'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('nexera-checkin-deadline'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Weekly check-in generation — Sunday 14:00 UTC, one POST per active gym.
SELECT cron.schedule(
  'nexera-checkin-generate',
  '0 14 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/agents/checkin-generate',
    headers := jsonb_build_object(
      'x-smartgym-internal-key', current_setting('app.settings.internal_webhook_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('gym_id', g.id)
  )
  FROM gyms g
  WHERE g.is_active = true
  $$
);

-- 48-hour deadline auto-send sweep — daily 22:00 UTC.
SELECT cron.schedule(
  'nexera-checkin-deadline',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.base_url', true) || '/api/cron/checkin-deadline',
    headers := jsonb_build_object(
      'x-smartgym-internal-key', current_setting('app.settings.internal_webhook_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
