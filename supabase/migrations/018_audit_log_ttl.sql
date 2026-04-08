-- Migration 018: Add TTL cleanup for audit logs
-- Auto-delete records older than 90 days via a scheduled cron job

-- Create index for efficient TTL queries (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_audit_log') THEN
    CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON ai_audit_log (created_at);
  END IF;
END;
$$;

-- Create a function to delete old audit log entries
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM ai_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

-- Schedule daily cleanup at 3:00 AM UTC via pg_cron (if extension available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 3 * * *',
      'SELECT cleanup_old_audit_logs()'
    );
  END IF;
END;
$$;

-- Also add index on app_events for similar TTL cleanup (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_events') THEN
    CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events (created_at);
  END IF;
END;
$$;
