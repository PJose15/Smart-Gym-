-- ═══════════════════════════════════════════════════════════════════════════════
-- NEXERA DEMO — AUTH USER CREATION + LINKING (DOC_04 Section 15)
--
-- ⚠️  RUN THIS IN THE SUPABASE SQL EDITOR (Dashboard → SQL Editor), NOT psql.
--     The SQL Editor runs with the privileges needed to write auth.users.
--     (On LOCAL supabase it also works via psql as the postgres superuser:
--      psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f supabase/seed-auth.sql)
--
-- Creates login-able demo users and links them to the seed-bulk data:
--   owner@ironsociety.com   DemoOwner2026!     (gym owner)
--   alex@ironsociety.com    DemoTrainer2026!   (trainer — Scenario C login)
--   maria@ironsociety.com   DemoTrainer2026!
--   jose@ironsociety.com    DemoTrainer2026!
--   laura@ironsociety.com   DemoTrainer2026!
--   admin@nexera.io         DemoAdmin2026!     (super admin)
--   +17875550003            phone/OTP          (Carlos — member demo; use the
--                                               local OTP autoconfirm / test OTP)
--
-- ADAPTATION NOTE (DOC_04 Section 15): the spec calls
--   supabase_auth.create_user(...) — that helper does not exist. This file
--   inserts auth.users/auth.identities directly with the SAME fixed UUIDs
--   that seed-bulk.sql used for public.users, so every FK lines up:
--     trainers  00000000-0000-0000-0002-000000000001..04
--     owner     00000000-0000-0000-0002-000000000005
--     admin     00000000-0000-0000-0002-000000000006
--     Carlos    00000000-0000-0000-0002-000000000007
--
-- IDEMPOTENT: auth rows are inserted only when the email/phone is absent;
-- public-side linking uses ON CONFLICT ... DO UPDATE / plain UPDATEs.
-- Safe to run before OR after seed-bulk.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. AUTH USERS (email + password) ────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('00000000-0000-0000-0002-000000000001'::uuid, 'alex@ironsociety.com',  'DemoTrainer2026!'),
      ('00000000-0000-0000-0002-000000000002'::uuid, 'maria@ironsociety.com', 'DemoTrainer2026!'),
      ('00000000-0000-0000-0002-000000000003'::uuid, 'jose@ironsociety.com',  'DemoTrainer2026!'),
      ('00000000-0000-0000-0002-000000000004'::uuid, 'laura@ironsociety.com', 'DemoTrainer2026!'),
      ('00000000-0000-0000-0002-000000000005'::uuid, 'owner@ironsociety.com', 'DemoOwner2026!'),
      ('00000000-0000-0000-0002-000000000006'::uuid, 'admin@nexera.io',       'DemoAdmin2026!')
    ) AS t(uid, email, pw)
  LOOP
    -- Only create when neither the id nor the email already exists
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = rec.uid OR u.email = rec.email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        rec.uid, 'authenticated', 'authenticated', rec.email,
        extensions.crypt(rec.pw, extensions.gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        NOW(), NOW(),
        '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), rec.uid, rec.uid::text, 'email',
        jsonb_build_object('sub', rec.uid::text, 'email', rec.email, 'email_verified', true),
        NOW(), NOW(), NOW()
      )
      ON CONFLICT (provider_id, provider) DO NOTHING;
    ELSE
      RAISE NOTICE 'auth user % already exists — skipped', rec.email;
    END IF;
  END LOOP;
END $$;

-- ─── 2. CARLOS — phone auth user (+17875550003, OTP login) ───────────────────
DO $$
DECLARE
  v_uid CONSTANT uuid := '00000000-0000-0000-0002-000000000007';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid OR u.phone = '17875550003') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, phone, phone_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', '17875550003', NOW(),
      '{"provider": "phone", "providers": ["phone"]}',
      '{}', NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_uid::text, 'phone',
      jsonb_build_object('sub', v_uid::text, 'phone', '17875550003'),
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  ELSE
    RAISE NOTICE 'auth user for +17875550003 already exists — skipped';
  END IF;
END $$;

-- ─── 3. LINK AUTH → PUBLIC (idempotent upserts; works even if seed-bulk ran
--        first with FK triggers disabled, or has not run yet) ─────────────────

-- public.users mirror rows (no-ops if seed-bulk already created them)
INSERT INTO public.users (id, email, phone, display_name, first_name, platform_role) VALUES
  ('00000000-0000-0000-0002-000000000001', 'alex@ironsociety.com',  NULL, 'Alex Rivera',  'Alex',  'trainer'),
  ('00000000-0000-0000-0002-000000000002', 'maria@ironsociety.com', NULL, 'Maria Santos', 'Maria', 'trainer'),
  ('00000000-0000-0000-0002-000000000003', 'jose@ironsociety.com',  NULL, 'José Mendez',  'José',  'trainer'),
  ('00000000-0000-0000-0002-000000000004', 'laura@ironsociety.com', NULL, 'Laura Kim',    'Laura', 'trainer'),
  ('00000000-0000-0000-0002-000000000005', 'owner@ironsociety.com', NULL, 'Rafael Ortiz', 'Rafael','gym_owner'),
  ('00000000-0000-0000-0002-000000000006', 'admin@nexera.io',       NULL, 'Nexera Admin', 'Admin', 'super_admin'),
  ('00000000-0000-0000-0002-000000000007', NULL, '+17875550003',          'Carlos Vega',  'Carlos','member')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      platform_role = EXCLUDED.platform_role;

-- Gym ownership (only meaningful once seed-bulk has created the gym)
UPDATE public.gyms
SET owner_id = '00000000-0000-0000-0002-000000000005'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Memberships (idempotent)
INSERT INTO public.gym_memberships (user_id, gym_id, role, status, permissions)
SELECT t.uid::uuid, '00000000-0000-0000-0000-000000000001', t.r, 'active', t.perms::jsonb
FROM (VALUES
  ('00000000-0000-0000-0002-000000000005', 'owner',   '{}'),
  ('00000000-0000-0000-0002-000000000001', 'trainer', '{"can_manage_all_members": true}'),
  ('00000000-0000-0000-0002-000000000002', 'trainer', '{"can_manage_all_members": true}'),
  ('00000000-0000-0000-0002-000000000003', 'trainer', '{}'),
  ('00000000-0000-0000-0002-000000000004', 'trainer', '{}'),
  ('00000000-0000-0000-0002-000000000007', 'member',  '{}')
) AS t(uid, r, perms)
WHERE EXISTS (SELECT 1 FROM public.gyms WHERE id = '00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, gym_id) DO UPDATE
  SET role = EXCLUDED.role, status = 'active';

-- Carlos: link the member record to his auth user
UPDATE public.members
SET user_id = '00000000-0000-0000-0002-000000000007'
WHERE id = '00000000-0000-0000-0001-000000000003'
  AND (user_id IS NULL OR user_id <> '00000000-0000-0000-0002-000000000007');

-- ─── 4. VERIFY ───────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE '%ironsociety.com' OR email = 'admin@nexera.io') AS email_auth_users,   -- expect 6
  (SELECT COUNT(*) FROM auth.users WHERE phone = '17875550003') AS carlos_auth,                                             -- expect 1
  (SELECT user_id FROM public.members WHERE id = '00000000-0000-0000-0001-000000000003') AS carlos_member_link,
  (SELECT owner_id FROM public.gyms WHERE id = '00000000-0000-0000-0000-000000000001') AS gym_owner_link;
