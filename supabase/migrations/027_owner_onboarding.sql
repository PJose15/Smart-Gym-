-- ============================================================
-- Migration 027 — Owner Onboarding Foundation
-- Creates: stripe_events_processed table, 'invited' onboarding
-- status, complete_gym_onboarding RPC, bulk_import_members RPC
-- ============================================================

-- ============================================================
-- SECTION 1: Stripe Webhook Idempotency Table
-- ============================================================

CREATE TABLE stripe_events_processed (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events_processed ENABLE ROW LEVEL SECURITY;
-- No policies: accessed only via service-role admin client (bypasses RLS)

COMMENT ON TABLE stripe_events_processed IS
  'Deduplicates Stripe webhook events — service role only, no RLS policies needed';

-- ============================================================
-- SECTION 2: Add ''invited'' to members.onboarding_status CHECK
-- ============================================================

ALTER TABLE members DROP CONSTRAINT members_onboarding_status_check;

ALTER TABLE members ADD CONSTRAINT members_onboarding_status_check
  CHECK (onboarding_status IN (
    'pending',
    'in_progress',
    'intake_complete',
    'active',
    'program_generating',
    'program_active',
    'invited'
  ));

-- ============================================================
-- SECTION 3: complete_gym_onboarding RPC
-- Atomically creates gym + membership + settings + billing.
-- Returns the new gym_id uuid.
-- ============================================================

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

      -- Insert succeeded — exit loop
      EXIT;

    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt >= v_max_tries THEN
        RAISE EXCEPTION
          'Gym slug collision after % attempts for slug: %',
          v_max_tries, p_gym_slug
          USING ERRCODE = 'unique_violation';
      END IF;
      -- Append a random 4-char hex suffix and retry
      v_slug := p_gym_slug || '-' || substr(md5(random()::text), 1, 4);
    END;
  END LOOP;

  -- Owner gym_membership row
  INSERT INTO gym_memberships (user_id, gym_id, role, status)
  VALUES (p_user_id, v_gym_id, 'owner', 'active');

  -- Default gym_settings (all columns have DB defaults)
  INSERT INTO gym_settings (gym_id)
  VALUES (v_gym_id);

  -- Billing row in trialing state
  INSERT INTO gym_billing (gym_id, tier, subscription_status)
  VALUES (v_gym_id, p_tier, 'trialing');

  RETURN v_gym_id;
END;
$$;

-- Restrict execution: only service_role may call this function
REVOKE EXECUTE ON FUNCTION complete_gym_onboarding(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION complete_gym_onboarding(uuid, text, text, text, text, text)
  TO service_role;

-- ============================================================
-- SECTION 4: bulk_import_members RPC
-- Inserts an array of member objects, skipping duplicates.
-- Returns { imported: int, skipped: [{row_index, reason}] }
-- ============================================================

CREATE OR REPLACE FUNCTION bulk_import_members(
  p_gym_id  uuid,
  p_members jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member      jsonb;
  v_row_index   int  := 0;
  v_imported    int  := 0;
  v_skipped     jsonb := '[]'::jsonb;
  v_email       text;
  v_phone       text;
  v_skip_reason text;
  v_exists      boolean;
BEGIN
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members) LOOP
    v_skip_reason := NULL;
    v_email := nullif(trim(v_member->>'email'), '');
    v_phone := nullif(trim(v_member->>'phone'), '');

    -- Duplicate check: active member with same email in this gym
    IF v_email IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM members
        WHERE gym_id = p_gym_id
          AND lower(email) = lower(v_email)
          AND is_active = true
      ) INTO v_exists;

      IF v_exists THEN
        v_skip_reason := 'duplicate_email';
      END IF;
    END IF;

    -- Duplicate check: active member with same phone in this gym
    IF v_skip_reason IS NULL AND v_phone IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM members
        WHERE gym_id = p_gym_id
          AND phone = v_phone
          AND is_active = true
      ) INTO v_exists;

      IF v_exists THEN
        v_skip_reason := 'duplicate_phone';
      END IF;
    END IF;

    IF v_skip_reason IS NOT NULL THEN
      -- Append skip record
      v_skipped := v_skipped || jsonb_build_object(
        'row_index', v_row_index,
        'reason',    v_skip_reason
      );
    ELSE
      INSERT INTO members (
        gym_id,
        user_id,
        display_name,
        first_name,
        email,
        phone,
        onboarding_status
      )
      VALUES (
        p_gym_id,
        NULL,
        coalesce(nullif(trim(v_member->>'display_name'), ''), nullif(trim(v_member->>'first_name'), ''), 'Member'),
        nullif(trim(v_member->>'first_name'), ''),
        v_email,
        v_phone,
        'invited'
      );
      v_imported := v_imported + 1;
    END IF;

    v_row_index := v_row_index + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'imported', v_imported,
    'skipped',  coalesce(v_skipped, '[]'::jsonb)
  );
END;
$$;

-- Restrict execution: only service_role may call this function
REVOKE EXECUTE ON FUNCTION bulk_import_members(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION bulk_import_members(uuid, jsonb)
  TO service_role;
