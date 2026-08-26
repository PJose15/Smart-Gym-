-- ═══════════════════════════════════════════════════════════════════
-- Migration 037: make the anon-lockout on new SECURITY DEFINER fns real
-- ═══════════════════════════════════════════════════════════════════
-- 034/035 did `REVOKE EXECUTE ... FROM anon` on the new SECURITY DEFINER
-- functions, but Postgres grants EXECUTE to PUBLIC by default, and anon
-- inherits it via PUBLIC — so the security advisor still lists these as
-- anon-executable. They are functionally safe (each raises when
-- auth.uid() is null / not a gym member), but the intended lockout should
-- actually hold. Revoke from PUBLIC and grant only the intended roles.
--
-- authenticated MUST keep EXECUTE on current_platform_role() — the
-- users_update_own policy (034) calls it during WITH CHECK evaluation as
-- the querying (authenticated) role.
--
-- Rollback: GRANT EXECUTE ON FUNCTION ... TO PUBLIC.

REVOKE EXECUTE ON FUNCTION current_platform_role()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_own_profile(text, text)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_own_onboarding_status(uuid, text)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_leaderboard(uuid, timestamptz, int) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION current_platform_role()                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_own_profile(text, text)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_own_onboarding_status(uuid, text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_leaderboard(uuid, timestamptz, int) TO authenticated, service_role;
