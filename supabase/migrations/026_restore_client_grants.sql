-- ═══════════════════════════════════════════════════════════════════
-- Migration 026: restore client role grants
-- ═══════════════════════════════════════════════════════════════════
-- Discovered while verifying the DOC_04 demo seed: the anon and
-- authenticated roles have NO privileges on any public table, view,
-- or function ("permission denied for table ..." 42501 on every
-- relation, verified with a logged-in JWT whose role claim is
-- 'authenticated'). Only service_role works, which is why web-admin's
-- server routes function while every direct-from-client Supabase
-- query (the mobile app's entire data layer) fails.
--
-- No migration in this repo ever REVOKEd these — the grants were lost
-- outside migration history. This restores the standard Supabase
-- model: clients get table privileges, RLS remains the enforcement
-- layer (130+ policies already cover every table; anon has no
-- user-scoped policies so it can only read tables with explicitly
-- public policies like feature_flags/achievement_definitions).
--
-- Rollback:
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
--   REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Future objects created by postgres (CLI migrations) get the same.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Re-assert migration 025's tightening (the blanket function grant
-- above re-granted authenticated, which is intended; anon stays out).
REVOKE EXECUTE ON FUNCTION increment_comment_count(uuid, int) FROM anon;
