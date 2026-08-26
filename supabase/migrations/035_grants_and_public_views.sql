-- ═══════════════════════════════════════════════════════════════════
-- Migration 035: narrow client grants, lock view writes, curate anon reads
-- (AUDIT_2026-08-25 Stage 1: M-3 grants, SEC-C3 view writes, BE-H6/M-4 anon)
-- ═══════════════════════════════════════════════════════════════════
-- Rollback: re-run 026 (blanket GRANT ALL + anon defaults), re-grant anon
-- SELECT on gyms/machines, drop the public_* views and the self-write RPCs.

-- ─── M-3: narrow `authenticated` from ALL to CRUD ───────────────────
-- 026 granted ALL (incl. TRUNCATE/REFERENCES/TRIGGER) to authenticated and
-- made every FUTURE table anon-SELECTable by default (the mechanism behind
-- the 032 view leak). Reduce to the four DML privileges and stop the anon
-- default. RLS remains the enforcement layer.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- ─── SEC-C3: revoke write on the RLS-bypassing views ────────────────
-- profiles/gym_members are owner-rights, auto-updatable views (kept
-- owner-rights so feed/leaderboard can resolve other members' names). The
-- blanket CRUD grant above re-exposes writes through them → a member could
-- UPDATE/DELETE underlying users/members rows bypassing RLS. Revoke writes;
-- legitimate self-writes move to the SECURITY DEFINER RPCs below.
-- (sets/badges/member_badges are security_invoker — RLS covers their writes,
-- incl. mobile badge unlock via member_badges — so they keep CRUD.)
REVOKE INSERT, UPDATE, DELETE ON profiles    FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON gym_members FROM authenticated, anon;

-- Self-write RPC #1: replaces mobile `profiles.upsert/update` (name/avatar).
CREATE OR REPLACE FUNCTION upsert_own_profile(
  p_full_name  text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE users
  SET display_name = COALESCE(p_full_name, display_name),
      avatar_url   = COALESCE(p_avatar_url, avatar_url)
  WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION upsert_own_profile(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_own_profile(text, text) TO authenticated;

-- Self-write RPC #2: replaces mobile `gym_members.update(onboarding_status)`.
-- The column's own CHECK constraint validates the status value.
CREATE OR REPLACE FUNCTION set_own_onboarding_status(
  p_gym_id uuid,
  p_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE members
  SET onboarding_status = p_status
  WHERE user_id = auth.uid() AND gym_id = p_gym_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION set_own_onboarding_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION set_own_onboarding_status(uuid, text) TO authenticated;

-- ─── BE-H6 / M-4: stop anon reading full gyms/machines rows ─────────
-- 001's gym_public_read / machines_public_read expose ALL columns
-- (subscription_tier/status, owner phone, machine purchase_price/date) to
-- any anon-key holder. Revoke anon SELECT on the base tables and expose
-- column-limited, is_active-filtered public projections for the QR landing.
-- (The web pre-auth landing currently reads via server routes / service
--  role; wiring any direct anon read to these views is tracked for Stage 5.)
REVOKE SELECT ON gyms    FROM anon;
REVOKE SELECT ON machines FROM anon;

CREATE OR REPLACE VIEW public_gym_landing AS
SELECT id, name, slug, logo_url, city
FROM gyms
WHERE is_active = true;

CREATE OR REPLACE VIEW public_machine_landing AS
SELECT m.id, m.gym_id, m.name, m.qr_slug, m.category, m.demo_image_url
FROM machines m
JOIN gyms g ON g.id = m.gym_id AND g.is_active = true
WHERE m.is_active = true;

GRANT SELECT ON public_gym_landing    TO anon, authenticated;
GRANT SELECT ON public_machine_landing TO anon, authenticated;
