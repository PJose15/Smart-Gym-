-- ═══════════════════════════════════════════════════════════════════
-- Migration 032: view security + schema fixes (sprint review findings)
-- ═══════════════════════════════════════════════════════════════════
-- 1) CRITICAL: the compatibility views (profiles, gym_members, sets,
--    badges, member_badges from migrations 021/022) execute with owner
--    rights and bypass RLS. Migration 026's blanket grants exposed them
--    to anon + authenticated → any anon-key holder could read every
--    user's email/name across all tenants via /rest/v1/profiles, and
--    any logged-in member could read every gym's member rows.
--    Fix: caller-scoped WHERE for profiles/gym_members (cross-member
--    name resolution within shared gyms only), security_invoker for
--    sets/badges/member_badges (RLS policies cover their use), and
--    REVOKE anon on all five.
-- 2) HIGH: machines cue columns (target_muscles etc.) exist in TS types
--    and the new POST /api/machines route but were never added by any
--    migration — the onboarding first-machine wizard 500s on live.
-- 3) MEDIUM: complete_gym_onboarding never set trial_ends_at, so the
--    trial countdown banner never renders for self-serve gyms.
-- 4) MEDIUM: quiet hours are member-local wall clock but the dispatcher
--    compares UTC — add a timezone column for correct conversion.
--
-- Rollback: restore 021/022 view definitions, drop the added columns,
-- re-grant anon SELECT (not recommended), restore 027's function body.

-- ─── Helper: caller's gym ids (member or staff) ─────────────────────
CREATE OR REPLACE FUNCTION caller_gym_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT g), '{}')
  FROM (
    SELECT gym_id AS g FROM members WHERE user_id = auth.uid()
    UNION
    SELECT gym_id AS g FROM gym_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION caller_gym_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION caller_gym_ids() FROM anon;
GRANT EXECUTE ON FUNCTION caller_gym_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION caller_gym_ids() TO service_role;

-- ─── profiles: self + shared-gym users + service role ───────────────
-- Stays auto-updatable (auth.tsx upserts through it); no CHECK OPTION
-- so self-upserts are unaffected.
CREATE OR REPLACE VIEW profiles AS
SELECT
  id,
  email,
  display_name AS full_name,
  avatar_url,
  created_at
FROM users
WHERE
  auth.jwt()->>'role' = 'service_role'
  OR id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = users.id AND m.gym_id = ANY(caller_gym_ids())
  )
  OR EXISTS (
    SELECT 1 FROM gym_memberships gm
    WHERE gm.user_id = users.id AND gm.gym_id = ANY(caller_gym_ids())
  );

-- ─── gym_members: rows only from the caller's gyms ──────────────────
CREATE OR REPLACE VIEW gym_members AS
SELECT
  id,
  gym_id,
  user_id AS profile_id,
  smartgym_score,
  onboarding_status,
  joined_gym_at AS joined_at,
  created_at
FROM members
WHERE
  auth.jwt()->>'role' = 'service_role'
  OR gym_id = ANY(caller_gym_ids());

-- ─── sets / badges / member_badges: enforce underlying RLS ──────────
-- workout_sets has "workout_sets_own" (FOR ALL), achievement_definitions
-- has "achievement_defs_public", member_achievements has own + owner
-- read policies — invoker semantics are sufficient.
ALTER VIEW sets SET (security_invoker = true);
ALTER VIEW badges SET (security_invoker = true);
ALTER VIEW member_badges SET (security_invoker = true);

-- Mobile badge unlocks INSERT through member_badges; under invoker
-- semantics that needs an INSERT policy (previously bypassed via owner
-- rights). Members may only record achievements for their own member
-- row in their own gym.
DROP POLICY IF EXISTS "member_achievements_own_insert" ON member_achievements;
CREATE POLICY "member_achievements_own_insert"
  ON member_achievements FOR INSERT
  WITH CHECK (
    gym_id = ANY(caller_gym_ids())
    AND member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- ─── Close the anon door on all five views ──────────────────────────
REVOKE SELECT ON profiles FROM anon;
REVOKE SELECT ON gym_members FROM anon;
REVOKE SELECT ON sets FROM anon;
REVOKE SELECT ON badges FROM anon;
REVOKE SELECT ON member_badges FROM anon;

-- ─── machines: formalize the cue columns the app already uses ───────
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS target_muscles    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS setup_steps       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_cues       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_mistakes   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cue_version       integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cue_source        text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS movement_pattern  text NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS equipment_type    text NOT NULL DEFAULT 'machine',
  ADD COLUMN IF NOT EXISTS difficulty        text NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS primary_muscles   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] NOT NULL DEFAULT '{}';

-- ─── trial_ends_at: self-serve gyms get a visible trial clock ───────
-- Identical to the 027 body except gym_billing now gets trial_ends_at.
CREATE OR REPLACE FUNCTION complete_gym_onboarding(
  p_user_id  uuid,
  p_gym_name text,
  p_gym_slug text,
  p_gym_city text    DEFAULT NULL,
  p_gym_type text    DEFAULT 'independent',
  p_tier     text    DEFAULT 'starter'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id    uuid;
  v_slug      text;
  v_attempt   int := 0;
  v_max_tries int := 3;
BEGIN
  v_slug := p_gym_slug;

  -- Slug-collision retry loop (up to 3 attempts with random suffix)
  LOOP
    BEGIN
      INSERT INTO gyms (
        name, slug, owner_id, gym_type, city,
        subscription_tier, subscription_status
      )
      VALUES (
        p_gym_name, v_slug, p_user_id, p_gym_type, p_gym_city,
        p_tier, 'trial'
      )
      RETURNING id INTO v_gym_id;

      EXIT;

    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt >= v_max_tries THEN
        RAISE EXCEPTION
          'Gym slug collision after % attempts for slug: %',
          v_max_tries, p_gym_slug
          USING ERRCODE = 'unique_violation';
      END IF;
      v_slug := p_gym_slug || '-' || substr(md5(random()::text), 1, 4);
    END;
  END LOOP;

  INSERT INTO gym_memberships (user_id, gym_id, role, status)
  VALUES (p_user_id, v_gym_id, 'owner', 'active');

  INSERT INTO gym_settings (gym_id)
  VALUES (v_gym_id);

  -- Billing row in trialing state with a visible 14-day trial clock
  INSERT INTO gym_billing (gym_id, tier, subscription_status, trial_ends_at)
  VALUES (v_gym_id, p_tier, 'trialing', now() + interval '14 days');

  RETURN v_gym_id;
END;
$$;

-- ─── notification_preferences: member timezone for quiet hours ──────
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN notification_preferences.timezone IS
  'IANA timezone (e.g. America/New_York) captured from the device when quiet hours are set. Dispatcher converts quiet-hour wall-clock times using this; null falls back to UTC.';
