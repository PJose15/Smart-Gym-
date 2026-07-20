-- 030: Grant service_role access to the public schema.
--
-- Earlier migrations granted anon/authenticated/postgres but never
-- service_role, so every server-side admin client query (verifyStaff,
-- owner dashboard, trainer APIs) failed with 42501 permission denied.
-- These grants restore the standard Supabase posture: service_role has
-- full table access and bypasses RLS; client-facing roles are unchanged.
-- Applied to the linked project directly on 2026-07-19.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
