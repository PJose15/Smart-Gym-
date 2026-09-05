-- ═══════════════════════════════════════════════════════════════════
-- Migration 043: Stage-6 AI cluster fixes  ── DRAFT — DO NOT APPLY YET
-- ═══════════════════════════════════════════════════════════════════
-- Three pieces, each paired with code that already tolerates this
-- migration NOT being applied (defensive reads / RPC fallback):
--
--   1. gym_settings.checkin_language — replaces the hardcoded 'en' in
--      lib/checkIn/gatherWeekData.ts (AI-M: gym_language hardcoded).
--   2. increment_challenge_score() RPC — atomic single-UPDATE score
--      increment for lib/challengeScoring.ts (AI-M: read-modify-write
--      race on challenge_participants.current_score). Includes a
--      server-side clamp mirroring the code-side one.
--   3. ai_audit_logs TTL tightened to 30 days (AI-M: health-adjacent
--      prompt inputs persisted with effectively no working TTL — 018
--      created cleanup_old_audit_logs() + its cron before the table
--      existed (019), so the 90-day cleanup path was never verified;
--      re-assert it here idempotently, mirroring 018's guard pattern).
--
-- Rollback:
--   ALTER TABLE gym_settings DROP COLUMN IF EXISTS checkin_language;
--   DROP FUNCTION IF EXISTS increment_challenge_score(uuid, numeric);
--   CREATE OR REPLACE cleanup_old_audit_logs() with INTERVAL '90 days'
--   (018 body) and re-schedule 'cleanup-audit-logs' as before.

-- ────────────────────────────────────────────────────────────────────
-- 1) Gym check-in language (read by gatherWeekData; defaults to 'en')
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS checkin_language text NOT NULL DEFAULT 'en'
    CHECK (checkin_language IN ('en', 'es'));

-- ────────────────────────────────────────────────────────────────────
-- 2) Atomic challenge score increment
-- ────────────────────────────────────────────────────────────────────
-- Single UPDATE with expression — concurrent session completions can no
-- longer lose increments (previous JS read-modify-write raced).
-- The 100000 clamp mirrors MAX_SESSION_VOLUME_LBS in challengeScoring.ts:
-- defense in depth against inflated per-session volume contributions.

CREATE OR REPLACE FUNCTION increment_challenge_score(
  p_participation_id uuid,
  p_increment        numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score numeric;
BEGIN
  IF p_increment IS NULL OR p_increment <= 0 THEN
    RAISE EXCEPTION 'increment must be positive';
  END IF;

  UPDATE challenge_participants
     SET current_score = current_score + LEAST(p_increment, 100000),
         updated_at    = now()
   WHERE id = p_participation_id
  RETURNING current_score INTO v_new_score;

  IF v_new_score IS NULL THEN
    RAISE EXCEPTION 'participation % not found', p_participation_id;
  END IF;

  RETURN v_new_score;
END;
$$;

-- Service-role only — the RPC is called by server code with the admin
-- client; members never invoke it directly (mirrors 037 grant pattern).
REVOKE EXECUTE ON FUNCTION increment_challenge_score(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION increment_challenge_score(uuid, numeric) TO service_role;

-- ────────────────────────────────────────────────────────────────────
-- 3) ai_audit_logs TTL — 30-day retention (PII minimization)
-- ────────────────────────────────────────────────────────────────────
-- Mirrors 018_audit_log_ttl.sql (guarded index + SECURITY DEFINER cleanup
-- fn + pg_cron schedule), but with retention tightened 90d → 30d for
-- ai_audit_logs because its `inputs` JSONB historically carried
-- injuries/limitations free-text (now redacted at write time in
-- ai-generate; old rows still age out under the new 30-day window).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_audit_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON ai_audit_logs (created_at);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ai_audit_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_old_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION cleanup_old_audit_logs() TO service_role;

-- Re-assert the daily 03:00 UTC schedule idempotently (unschedule-if-exists
-- then schedule — cron.schedule with a duplicate jobname errors).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-audit-logs') THEN
      PERFORM cron.unschedule('cleanup-audit-logs');
    END IF;
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 3 * * *',
      'SELECT cleanup_old_audit_logs()'
    );
  END IF;
END;
$$;
