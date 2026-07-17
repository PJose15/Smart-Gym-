-- ═══════════════════════════════════════════════════════════════════════════════
-- NEXERA BULK SEED — DEMO ENVIRONMENT (DOC_04)
-- Demo gym: "Iron Society" — 00000000-0000-0000-0000-000000000001
--
-- Run AFTER migrations and the basic seed (supabase/seed.sql).
--   Local:  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--             -v ON_ERROR_STOP=1 -f supabase/seed-bulk.sql
--   Or use: scripts/seed-demo.ps1 / scripts/seed-demo.sh
--
-- Generates: 50 members, 4 trainers + owner + admin, 20 machines,
--            12 programs (3 trainer templates + 9 AI), ~1,000 sessions over
--            90 days with progressive overload + PR detection, 180+
--            achievements, 200+ feed events with reactions/comments,
--            6 challenges, 40+ weekly check-ins, coach notes, messages,
--            body metrics, readiness/muscle/DNA caches, leaderboards.
--
-- IDEMPOTENT: fixed / md5-derived UUIDs + ON CONFLICT everywhere.
--             Re-running is safe (existing rows are skipped or refreshed).
-- DETERMINISTIC: setseed() + hashtext() drive all "random" values.
--
-- NOTE ON AUTH: public.users.id references auth.users(id). This file runs
-- with session_replication_role='replica' (FK triggers disabled) so the
-- fixed staff UUIDs can be inserted BEFORE auth users exist. Run
-- supabase/seed-auth.sql afterwards (Supabase SQL Editor) to create the
-- matching auth.users rows with the SAME fixed UUIDs.
-- If you cannot set replica mode (hosted project), run seed-auth.sql FIRST,
-- then this file.
--
-- FIXED UUID MAP
--   Gym ......................... 00000000-0000-0000-0000-000000000001
--   Trainers (users) ............ 00000000-0000-0000-0002-000000000001..04
--       01 Alex Rivera   alex@ironsociety.com
--       02 Maria Santos  maria@ironsociety.com
--       03 Jose Mendez   jose@ironsociety.com
--       04 Laura Kim     laura@ironsociety.com
--   Owner (users) ............... 00000000-0000-0000-0002-000000000005  owner@ironsociety.com
--   Super admin (users) ......... 00000000-0000-0000-0002-000000000006  admin@nexera.io
--   Carlos auth user (users) .... 00000000-0000-0000-0002-000000000007  +17875550003
--   Members ..................... 00000000-0000-0000-0001-000000000001..050
--   Machines .................... 00000000-0000-0000-0003-000000000001..020
--   Trainer program templates ... 00000000-0000-0000-0004-000000000001..03
--   AI programs ................. 00000000-0000-0000-0004-000000000101..109
--   Challenges .................. 00000000-0000-0000-0007-000000000001..06
--   Generated rows .............. md5('nx-<kind>-<key>')::uuid
-- ═══════════════════════════════════════════════════════════════════════════════

-- Deterministic random()
SELECT setseed(0.42);

-- Disable triggers (incl. FK checks) during bulk insert.
-- Wrapped so hosted projects without the privilege still proceed
-- (run seed-auth.sql first in that case).
DO $$ BEGIN
  SET session_replication_role = 'replica';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Cannot set session_replication_role - run seed-auth.sql first so FK targets exist.';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — STAFF USERS (owner, 4 trainers, super admin, Carlos's user)
-- Adapted from DOC_04: real users table is
--   users(id, email, phone, display_name, first_name, avatar_url, platform_role)
-- (no name/role/gym_id columns); gym linkage lives in gym_memberships.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.users (id, email, phone, display_name, first_name, avatar_url, platform_role, created_at) VALUES
  ('00000000-0000-0000-0002-000000000001', 'alex@ironsociety.com',  NULL, 'Alex Rivera',  'Alex',  'https://api.dicebear.com/7.x/avataaars/svg?seed=alexrivera',  'trainer',     NOW() - INTERVAL '110 days'),
  ('00000000-0000-0000-0002-000000000002', 'maria@ironsociety.com', NULL, 'Maria Santos', 'Maria', 'https://api.dicebear.com/7.x/avataaars/svg?seed=mariasantos', 'trainer',     NOW() - INTERVAL '105 days'),
  ('00000000-0000-0000-0002-000000000003', 'jose@ironsociety.com',  NULL, 'José Mendez',  'José',  'https://api.dicebear.com/7.x/avataaars/svg?seed=josemendez',  'trainer',     NOW() - INTERVAL '60 days'),
  ('00000000-0000-0000-0002-000000000004', 'laura@ironsociety.com', NULL, 'Laura Kim',    'Laura', 'https://api.dicebear.com/7.x/avataaars/svg?seed=laurakim',    'trainer',     NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0002-000000000005', 'owner@ironsociety.com', NULL, 'Rafael Ortiz', 'Rafael','https://api.dicebear.com/7.x/avataaars/svg?seed=rafaelortiz', 'gym_owner',   NOW() - INTERVAL '120 days'),
  ('00000000-0000-0000-0002-000000000006', 'admin@nexera.io',       NULL, 'Nexera Admin', 'Admin', NULL,                                                          'super_admin', NOW() - INTERVAL '200 days'),
  ('00000000-0000-0000-0002-000000000007', NULL, '+17875550003',          'Carlos Vega',  'Carlos','https://api.dicebear.com/7.x/avataaars/svg?seed=carlos',      'member',      NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — DEMO GYM (Iron Society)
-- Adapted from DOC_04: gyms has no trial_ends_at/timezone/health_score columns;
-- trial/period data lives in gym_billing, timezone in gym_settings, and
-- health_score does not exist anywhere in the real schema (omitted).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.gyms (
  id, name, slug, owner_id, gym_type, description,
  address, city, country, phone, logo_url,
  subscription_tier, subscription_status, is_active, created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Iron Society',
  'iron-society',
  '00000000-0000-0000-0002-000000000005',
  'independent',
  'San Juan''s home for serious training. 20 machines, 4 coaches, zero excuses.',
  '1450 Calle Loíza',
  'San Juan',
  'PR',
  '+1 (787) 555-0100',
  'https://placehold.co/200x200/7C5CFF/FFFFFF?text=IS',
  'growth',
  'active',
  true,
  NOW() - INTERVAL '120 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gym_settings (
  gym_id, gym_open_time, gym_close_time, timezone, currency, weight_unit,
  show_gym_feed, show_leaderboards, enable_member_chat_with_ai,
  ai_program_auto_generate, at_risk_threshold_days
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '05:00', '23:00', 'America/Puerto_Rico', 'USD', 'lbs',
  true, true, true,
  true, 14
)
ON CONFLICT (gym_id) DO NOTHING;

-- Adapted: gym_billing uses tier/billing_interval; no plan_name /
-- monthly_amount_cents / current_period_start columns in the real schema.
INSERT INTO public.gym_billing (
  gym_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
  tier, billing_interval, subscription_status, current_period_end
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'cus_demo_iron_society',
  'sub_demo_iron_society',
  'price_demo_growth_299',
  'growth', 'monthly', 'active', NOW() + INTERVAL '30 days'
)
ON CONFLICT (gym_id) DO NOTHING;

-- Staff memberships
INSERT INTO public.gym_memberships (user_id, gym_id, role, status, permissions, joined_at) VALUES
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000000001', 'owner',   'active', '{}',                               NOW() - INTERVAL '120 days'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', '{"can_manage_all_members": true}', NOW() - INTERVAL '110 days'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', '{"can_manage_all_members": true}', NOW() - INTERVAL '105 days'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', '{}',                               NOW() - INTERVAL '60 days'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', '{}',                               NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0000-000000000001', 'member',  'active', '{}',                               NOW() - INTERVAL '90 days')
ON CONFLICT (user_id, gym_id) DO NOTHING;

-- Trainer style settings for the copilot.
-- Adapted: real table is trainer_style_settings(gym_id, trainer_profile_id,
-- tone IN strict/supportive/neutral, verbosity IN short/standard/detailed).
-- DOC_04's trainer_style_settings(trainer_id, tone motivational/friendly/...,
-- focus_areas) does not exist — mapped onto the real enums.
INSERT INTO public.trainer_style_settings (gym_id, trainer_profile_id, tone, verbosity) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000001', 'supportive', 'detailed'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000002', 'supportive', 'standard'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000003', 'neutral',    'short'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0002-000000000004', 'supportive', 'standard')
ON CONFLICT (gym_id, trainer_profile_id) DO NOTHING;

INSERT INTO public.trainer_preferences (trainer_id) VALUES
  ('00000000-0000-0000-0002-000000000001'),
  ('00000000-0000-0000-0002-000000000002'),
  ('00000000-0000-0000-0002-000000000003'),
  ('00000000-0000-0000-0002-000000000004')
ON CONFLICT (trainer_id) DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — MEMBERS (6 fully-built primaries + 44 bulk-generated)
-- Adapted from DOC_04 to the real members schema:
--   name              → display_name (+ first_name)
--   goal              → primary_goal  (muscle-gain|strength|weight-loss|endurance|general-fitness)
--   limitations[]     → injuries_or_limitations (text)
--   weight_unit       → member_settings.weight_unit
--   smartgym_score    → kept; current_level does NOT exist (derived via get_member_level())
--   streak_weeks      → current_streak (+ best_streak)
--   last_session_at   → last_session_date (date) + last_seen_at
--   onboarding_completed_at → onboarding_status ('active' / 'program_active')
--   status 'at_risk'/'inactive' → NOT valid CHECK values. Real status stays
--     'active'; at-risk/inactive is DERIVED from last_session_date age
--     (get_at_risk_members + gym_settings.at_risk_threshold_days).
-- Trainer coverage: Alex → 01-12, Maria → 13-25, José → 26-38, Laura → 39-50.
-- ─────────────────────────────────────────────────────────────────────────────

-- MEMBER 01: MARCUS RODRIGUEZ — power user. 11-wk streak, top of leaderboard.
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', NULL,
  'Marcus Rodriguez', 'Marcus', '+17875550001', 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus',
  'muscle-gain', 'advanced', NULL,
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '100 days', 'active',
  'active', true, 7840, 11, 11,
  CURRENT_DATE - 1, CURRENT_DATE - 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '115 days', NOW() - INTERVAL '115 days'
) ON CONFLICT (id) DO NOTHING;

-- MEMBER 02: SOFIA CHEN — consistent. 6-wk streak.
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', NULL,
  'Sofia Chen', 'Sofia', '+17875550002', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sofia',
  'general-fitness', 'intermediate', NULL,
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '95 days', 'active',
  'active', true, 4200, 6, 7,
  CURRENT_DATE - 2, CURRENT_DATE - 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days'
) ON CONFLICT (id) DO NOTHING;

-- MEMBER 03: CARLOS VEGA — THE DEMO PRIMARY. Phone +17875550003, OTP 123456.
-- Linked to fixed auth/user UUID ...0002-...0007 (created by seed-auth.sql).
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000007',
  'Carlos Vega', 'Carlos', '+17875550003', 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos',
  'muscle-gain', 'intermediate', NULL,
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '80 days', 'program_active',
  'active', true, 2800, 4, 5,
  CURRENT_DATE - 1, CURRENT_DATE - 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'
) ON CONFLICT (id) DO NOTHING;

-- MEMBER 04: ANA PÉREZ — at-risk (18 days since last session; derived state).
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', NULL,
  'Ana Pérez', 'Ana', '+17875550004', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ana',
  'weight-loss', 'beginner', NULL,
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '70 days', 'active',
  'active', true, 950, 0, 4,
  CURRENT_DATE - 18, CURRENT_DATE - 18, NOW() - INTERVAL '18 days', NOW() - INTERVAL '75 days', NOW() - INTERVAL '75 days'
) ON CONFLICT (id) DO NOTHING;

-- MEMBER 05: JORGE SANTOS — new member (joined 8 days ago), lower-back note.
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', NULL,
  'Jorge Santos', 'Jorge', '+17875550005', 'https://api.dicebear.com/7.x/avataaars/svg?seed=jorge',
  'general-fitness', 'beginner', 'lower back',
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '7 days', 'active',
  'active', true, 175, 1, 1,
  CURRENT_DATE - 1, CURRENT_DATE - 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'
) ON CONFLICT (id) DO NOTHING;

-- MEMBER 06: ISABELLA MORALES — comeback (22-day gap, returned 3 days ago).
INSERT INTO public.members (
  id, gym_id, user_id, display_name, first_name, phone, avatar_url,
  primary_goal, experience_level, injuries_or_limitations,
  assigned_trainer_id, trainer_assigned_at, onboarding_status,
  status, is_active, smartgym_score, current_streak, best_streak,
  streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
) VALUES (
  '00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', NULL,
  'Isabella Morales', 'Isabella', '+17875550006', 'https://api.dicebear.com/7.x/avataaars/svg?seed=isabella',
  'weight-loss', 'intermediate', NULL,
  '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '75 days', 'active',
  'active', true, 1800, 0, 6,
  CURRENT_DATE - 3, CURRENT_DATE - 3, NOW() - INTERVAL '3 days', NOW() - INTERVAL '85 days', NOW() - INTERVAL '85 days'
) ON CONFLICT (id) DO NOTHING;

-- Member settings for the primaries (weight_unit lives HERE, not on members)
INSERT INTO public.member_settings (member_id, weight_unit) VALUES
  ('00000000-0000-0000-0001-000000000001', 'lbs'),
  ('00000000-0000-0000-0001-000000000002', 'lbs'),
  ('00000000-0000-0000-0001-000000000003', 'lbs'),
  ('00000000-0000-0000-0001-000000000004', 'lbs'),
  ('00000000-0000-0000-0001-000000000005', 'lbs'),
  ('00000000-0000-0000-0001-000000000006', 'kg')
ON CONFLICT (member_id) DO NOTHING;

-- BULK MEMBERS 07-50 — deterministic archetype bands:
--   07-13 power (7) · 14-26 consistent (13) · 27-37 casual (11)
--   38-44 at-risk (7) · 45-48 inactive (4) · 49-50 new (2)
DO $$
DECLARE
  v_names TEXT[] := ARRAY[
    'Diego Rivera','Valentina Cruz','Alejandro Reyes','Camila Flores',
    'Sebastián López','Natalia Gómez','Mateo Hernández','Gabriela Torres',
    'Andrés Ramírez','Luciana Díaz','Fernando Moreno','Daniela Jiménez',
    'Ricardo Mendoza','Paula Castillo','Javier Vargas','Mónica Gutiérrez',
    'Luis Medina','Patricia Romero','Eduardo Suárez','Fernanda Herrera',
    'Roberto Núñez','Claudia Ramos','Arturo Alvarado','Sofía Vega',
    'Marco Delgado','Elena Ortega','Víctor Ruiz','Laura Soto',
    'Rodrigo Fuentes','Carmen Aguilar','Miguel Ángel Rojas','Adriana Silva',
    'Antonio Bermúdez','Vanessa Correa','Gerardo Muñoz','Ximena Acosta',
    'Héctor Sandoval','Patricia Luna','Benjamín Mendez','Rosa Álvarez',
    'Octavio Cárdenas','Ingrid Estrada','Alfredo Montes','Verónica Campos'
  ];
  v_goals  TEXT[] := ARRAY['weight-loss','muscle-gain','general-fitness','endurance','strength'];
  v_levels TEXT[] := ARRAY['beginner','beginner','intermediate','intermediate','advanced'];
  i         INTEGER;
  v_name    TEXT;
  v_group   TEXT;
  v_score   INTEGER;
  v_streak  INTEGER;
  v_last    INTEGER;   -- days since last session
  v_joined  INTEGER;   -- days since joined
  v_trainer UUID;
  h         INTEGER;
BEGIN
  PERFORM setseed(0.42);
  FOR i IN 7..50 LOOP
    v_name := v_names[i - 6];
    h := abs(hashtext('nx-member-' || i));
    v_group := CASE
      WHEN i <= 13 THEN 'power'
      WHEN i <= 26 THEN 'consistent'
      WHEN i <= 37 THEN 'casual'
      WHEN i <= 44 THEN 'at_risk'
      WHEN i <= 48 THEN 'inactive'
      ELSE              'new' END;
    v_score := CASE v_group
      WHEN 'power'      THEN 5000 + (h % 2800)
      WHEN 'consistent' THEN 1500 + (h % 3000)
      WHEN 'casual'     THEN 300  + (h % 1200)
      WHEN 'at_risk'    THEN 300  + (h % 1700)
      WHEN 'inactive'   THEN 100  + (h % 700)
      ELSE                   50   + (h % 200) END;
    v_streak := CASE v_group
      WHEN 'power'      THEN 6 + (h % 7)
      WHEN 'consistent' THEN 2 + (h % 6)
      WHEN 'casual'     THEN h % 3
      WHEN 'new'        THEN 1
      ELSE 0 END;
    v_last := CASE v_group
      WHEN 'power'      THEN h % 3
      WHEN 'consistent' THEN 1 + (h % 4)
      WHEN 'casual'     THEN 2 + (h % 6)
      WHEN 'at_risk'    THEN 14 + (h % 17)
      WHEN 'inactive'   THEN 31 + (h % 30)
      ELSE                   h % 3 END;
    v_joined := CASE v_group
      WHEN 'new' THEN 3 + (h % 10)
      ELSE            60 + (h % 60) END;
    v_trainer := CASE
      WHEN i <= 12 THEN '00000000-0000-0000-0002-000000000001'::uuid
      WHEN i <= 25 THEN '00000000-0000-0000-0002-000000000002'::uuid
      WHEN i <= 38 THEN '00000000-0000-0000-0002-000000000003'::uuid
      ELSE              '00000000-0000-0000-0002-000000000004'::uuid END;

    INSERT INTO public.members (
      id, gym_id, display_name, first_name, phone, avatar_url,
      primary_goal, experience_level,
      assigned_trainer_id, trainer_assigned_at, onboarding_status,
      status, is_active, smartgym_score, current_streak, best_streak,
      streak_last_updated, last_session_date, last_seen_at, joined_gym_at, created_at
    ) VALUES (
      ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
      '00000000-0000-0000-0000-000000000001',
      v_name,
      split_part(v_name, ' ', 1),
      '+1787555' || lpad(i::text, 4, '0'),
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || lower(replace(v_name, ' ', '')),
      v_goals[1 + (h % 5)],
      v_levels[1 + (h % 5)],
      v_trainer,
      NOW() - ((v_joined - 2) || ' days')::interval,
      'active',
      'active', true, v_score, v_streak, GREATEST(v_streak, (h % 9)),
      CURRENT_DATE - v_last,
      CURRENT_DATE - v_last,
      NOW() - (v_last || ' days')::interval,
      NOW() - (v_joined || ' days')::interval,
      NOW() - (v_joined || ' days')::interval
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — 20 MACHINES
-- Adapted from DOC_04: machines has muscle_groups text[] (spec's
-- muscles_primary + muscles_secondary merged), instructions text (spec's
-- common_mistakes[] folded into instructions), qr_slug (spec's slug),
-- is_active (spec's status). Categories: strength|cardio|cable|functional.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.machines (
  id, gym_id, name, category, muscle_groups, instructions,
  qr_slug, location_in_gym, purchase_price, purchase_date, is_active
) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001',
   'Chest Press Machine', 'strength', ARRAY['chest','triceps','shoulders'],
   'Set seat so handles align with mid-chest. Push straight forward, control the return. Avoid: flaring elbows too wide, bouncing the weight, stopping short of full extension.',
   'chest-press', 'Strength Zone A', 2800.00, CURRENT_DATE - 400, true),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000001',
   'Overhead Press Machine', 'strength', ARRAY['shoulders','triceps','chest'],
   'Adjust seat so handles start at shoulder height. Press directly overhead. Avoid: arching the lower back, skipping lockout, using momentum.',
   'overhead-press', 'Strength Zone A', 3200.00, CURRENT_DATE - 400, true),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000001',
   'Cable Crossover', 'cable', ARRAY['chest','shoulders','biceps'],
   'Set pulleys at shoulder height. Step forward, cross hands at center. Avoid: swinging the torso, overloading and losing range, skipping the squeeze at peak.',
   'cable-crossover', 'Cable Alley', 4500.00, CURRENT_DATE - 380, true),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001',
   'Lat Pulldown', 'strength', ARRAY['back','lats','biceps'],
   'Grip bar slightly wider than shoulders. Pull to upper chest, lean back slightly. Avoid: excessive weight, pulling behind the neck, shrugged shoulders.',
   'lat-pulldown-is', 'Strength Zone B', 2600.00, CURRENT_DATE - 400, true),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001',
   'Seated Row Machine', 'strength', ARRAY['back','lats','biceps'],
   'Sit with chest against pad. Row handles to lower chest, squeeze shoulder blades. Avoid: shrugging, pulling with the lower back, cutting the stretch short.',
   'seated-row', 'Strength Zone B', 2400.00, CURRENT_DATE - 380, true),
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000001',
   'Cable Row — Low Pulley', 'cable', ARRAY['back','lats','biceps'],
   'Sit on bench, feet on platform. Pull V-bar to navel, drive elbows back. Avoid: rounding the lower back, jerking the weight, releasing too fast.',
   'cable-row-low', 'Cable Alley', 1200.00, CURRENT_DATE - 350, true),
  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0000-000000000001',
   'Leg Press', 'strength', ARRAY['quadriceps','glutes','hamstrings','calves'],
   'Feet shoulder-width on platform. Lower to 90 degrees, press through heels. Avoid: locking knees at the top, feet too low, letting the lower back round.',
   'leg-press-is', 'Leg Zone', 5800.00, CURRENT_DATE - 420, true),
  ('00000000-0000-0000-0003-000000000008', '00000000-0000-0000-0000-000000000001',
   'Leg Extension', 'strength', ARRAY['quadriceps'],
   'Set pad just above ankles. Extend fully, pause at top, lower with control. Avoid: swinging the weight, partial range, going too heavy.',
   'leg-extension', 'Leg Zone', 1800.00, CURRENT_DATE - 420, true),
  ('00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0000-000000000001',
   'Leg Curl Machine', 'strength', ARRAY['hamstrings','calves'],
   'Lie face down, pad behind ankles. Curl to 90 degrees, lower with control. Avoid: lifting hips off the pad, partial curls, dropping the weight.',
   'leg-curl', 'Leg Zone', 1800.00, CURRENT_DATE - 420, true),
  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0000-000000000001',
   'Hip Abductor Machine', 'strength', ARRAY['glutes','hips'],
   'Sit with pads on outer thighs. Push out against resistance, control the return. Avoid: rocking the torso, short range, rushing reps.',
   'hip-abductor', 'Leg Zone', 1600.00, CURRENT_DATE - 300, true),
  ('00000000-0000-0000-0003-000000000011', '00000000-0000-0000-0000-000000000001',
   'Bicep Curl Machine', 'strength', ARRAY['biceps','forearms'],
   'Set arms on pad, grip bar underhand. Curl fully, lower with control. Avoid: lifting elbows off the pad, partial extension, momentum.',
   'bicep-curl', 'Strength Zone C', 1400.00, CURRENT_DATE - 300, true),
  ('00000000-0000-0000-0003-000000000012', '00000000-0000-0000-0000-000000000001',
   'Tricep Pushdown — Cable', 'cable', ARRAY['triceps'],
   'Stand at cable tower, elbows at sides. Push bar down fully, control up. Avoid: elbows drifting forward, leaning into the weight, partial reps.',
   'tricep-pushdown', 'Cable Alley', 1200.00, CURRENT_DATE - 300, true),
  ('00000000-0000-0000-0003-000000000013', '00000000-0000-0000-0000-000000000001',
   'Ab Crunch Machine', 'strength', ARRAY['core','abs'],
   'Hold handles, crunch forward using abs — not hip flexors. Avoid: pulling with the arms, momentum, incomplete contraction.',
   'ab-crunch', 'Strength Zone C', 1500.00, CURRENT_DATE - 280, true),
  ('00000000-0000-0000-0003-000000000014', '00000000-0000-0000-0000-000000000001',
   'Treadmill A', 'cardio', ARRAY['quadriceps','calves','glutes','hamstrings'],
   'Start slow, build to target speed. Upright posture, natural arm swing. Avoid: holding the rails, looking down, overstriding.',
   'treadmill-a', 'Cardio Deck', 8500.00, CURRENT_DATE - 450, true),
  ('00000000-0000-0000-0003-000000000015', '00000000-0000-0000-0000-000000000001',
   'Treadmill B', 'cardio', ARRAY['quadriceps','calves','glutes','hamstrings'],
   'Start slow, build to target speed. Upright posture, natural arm swing. Avoid: holding the rails, looking down, overstriding.',
   'treadmill-b', 'Cardio Deck', 8500.00, CURRENT_DATE - 450, true),
  ('00000000-0000-0000-0003-000000000016', '00000000-0000-0000-0000-000000000001',
   'Elliptical Trainer', 'cardio', ARRAY['quadriceps','glutes','hamstrings','calves'],
   'Set resistance, push and pull the handles. Stay upright, full stride. Avoid: leaning on handles, resistance too low, short stride.',
   'elliptical', 'Cardio Deck', 6200.00, CURRENT_DATE - 430, true),
  ('00000000-0000-0000-0003-000000000017', '00000000-0000-0000-0000-000000000001',
   'Rowing Machine', 'cardio', ARRAY['back','lats','quadriceps','hamstrings','biceps'],
   'Drive with legs first, then lean back, then pull arms. Reverse on the return. Avoid: arms-first pulling, hunching, racing the stroke rate.',
   'rowing-machine', 'Cardio Deck', 3800.00, CURRENT_DATE - 430, true),
  ('00000000-0000-0000-0003-000000000018', '00000000-0000-0000-0000-000000000001',
   'Stationary Bike', 'cardio', ARRAY['quadriceps','calves','glutes','hamstrings'],
   'Adjust seat so the leg is nearly straight at the bottom of the pedal stroke. Avoid: seat too low, hunched shoulders, pedaling with the toes.',
   'stationary-bike', 'Cardio Deck', 4200.00, CURRENT_DATE - 430, true),
  ('00000000-0000-0000-0003-000000000019', '00000000-0000-0000-0000-000000000001',
   'Smith Machine', 'functional', ARRAY['quadriceps','chest','shoulders','glutes','triceps'],
   'Guided barbell for squats, bench and shoulder press. Avoid: squatting too far forward, bad bar path on bench, locking joints hard.',
   'smith-machine', 'Free Weights', 6500.00, CURRENT_DATE - 500, true),
  ('00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0000-000000000001',
   'Functional Trainer — Dual Cable', 'functional', ARRAY['chest','back','shoulders','core'],
   'Fully adjustable dual cable system. Set height for the exercise, keep core braced. Avoid: wrong cable height, losing core tension, overloading.',
   'functional-trainer', 'Free Weights', 7800.00, CURRENT_DATE - 500, true)
ON CONFLICT (id) DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — PROGRAMS (12 total: 3 trainer templates + 9 AI programs)
-- Adapted from DOC_04: the spec's single `programs` table with type/member_id
-- maps to TWO real structures:
--   * trainer templates → programs + program_days + program_exercises
--     (program_days has no `focus`; program_exercises has default_sets/
--      default_reps/order_index — no reps_min/max, rest_seconds or notes)
--   * AI programs → ai_programs with program_data jsonb
--     ({days:[{day_number,name,exercises:[{exercise_name,machine_id,
--       default_sets,default_reps}]}]} — the shape /api/programs/active reads)
-- member_program_assignments = (member_id, program_id → programs, ai_program_id,
--   assigned_by, assigned_at, status). It only references trainer templates,
--   so Carlos's AI program is "assigned" via ai_programs.is_active instead.
-- ─────────────────────────────────────────────────────────────────────────────

-- Trainer template 1: Power Builder — PPL (Alex)
INSERT INTO public.programs (id, gym_id, name, description, goal, duration_weeks, sessions_per_week, is_active, created_by) VALUES
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001',
   'Power Builder — PPL',
   'Push/Pull/Legs split for intermediate-advanced lifters focused on strength gains.',
   'strength', 8, 6, true, '00000000-0000-0000-0002-000000000001'),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001',
   'Full Body Foundation',
   'Three days per week full body training. Great for beginners and intermediates.',
   'general-fitness', 6, 3, true, '00000000-0000-0000-0002-000000000002'),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001',
   'Lean & Strong Circuit',
   'Four-day machine circuit balancing strength work and conditioning.',
   'weight-loss', 6, 4, true, '00000000-0000-0000-0002-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.program_days (id, program_id, day_number, name) VALUES
  -- PPL
  ('00000000-0000-0000-0005-000000000011', '00000000-0000-0000-0004-000000000001', 1, 'Push A'),
  ('00000000-0000-0000-0005-000000000012', '00000000-0000-0000-0004-000000000001', 2, 'Pull A'),
  ('00000000-0000-0000-0005-000000000013', '00000000-0000-0000-0004-000000000001', 3, 'Legs A'),
  ('00000000-0000-0000-0005-000000000014', '00000000-0000-0000-0004-000000000001', 4, 'Push B'),
  ('00000000-0000-0000-0005-000000000015', '00000000-0000-0000-0004-000000000001', 5, 'Pull B'),
  ('00000000-0000-0000-0005-000000000016', '00000000-0000-0000-0004-000000000001', 6, 'Legs B'),
  -- Full Body
  ('00000000-0000-0000-0005-000000000021', '00000000-0000-0000-0004-000000000002', 1, 'Full Body 1'),
  ('00000000-0000-0000-0005-000000000022', '00000000-0000-0000-0004-000000000002', 2, 'Full Body 2'),
  ('00000000-0000-0000-0005-000000000023', '00000000-0000-0000-0004-000000000002', 3, 'Full Body 3'),
  -- Circuit
  ('00000000-0000-0000-0005-000000000031', '00000000-0000-0000-0004-000000000003', 1, 'Upper Circuit'),
  ('00000000-0000-0000-0005-000000000032', '00000000-0000-0000-0004-000000000003', 2, 'Lower Circuit'),
  ('00000000-0000-0000-0005-000000000033', '00000000-0000-0000-0004-000000000003', 3, 'Push-Pull Circuit'),
  ('00000000-0000-0000-0005-000000000034', '00000000-0000-0000-0004-000000000003', 4, 'Cardio + Core')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.program_exercises (id, program_day_id, exercise_name, machine_id, default_sets, default_reps, order_index) VALUES
  -- PPL / Push A
  ('00000000-0000-0000-0006-000000000101', '00000000-0000-0000-0005-000000000011', 'Chest Press',      '00000000-0000-0000-0003-000000000001', 4, 8,  1),
  ('00000000-0000-0000-0006-000000000102', '00000000-0000-0000-0005-000000000011', 'Overhead Press',   '00000000-0000-0000-0003-000000000002', 3, 10, 2),
  ('00000000-0000-0000-0006-000000000103', '00000000-0000-0000-0005-000000000011', 'Tricep Pushdown',  '00000000-0000-0000-0003-000000000012', 3, 12, 3),
  -- PPL / Pull A
  ('00000000-0000-0000-0006-000000000104', '00000000-0000-0000-0005-000000000012', 'Lat Pulldown',     '00000000-0000-0000-0003-000000000004', 4, 10, 1),
  ('00000000-0000-0000-0006-000000000105', '00000000-0000-0000-0005-000000000012', 'Seated Row',       '00000000-0000-0000-0003-000000000005', 3, 10, 2),
  ('00000000-0000-0000-0006-000000000106', '00000000-0000-0000-0005-000000000012', 'Bicep Curl',       '00000000-0000-0000-0003-000000000011', 3, 12, 3),
  -- PPL / Legs A
  ('00000000-0000-0000-0006-000000000107', '00000000-0000-0000-0005-000000000013', 'Leg Press',        '00000000-0000-0000-0003-000000000007', 4, 10, 1),
  ('00000000-0000-0000-0006-000000000108', '00000000-0000-0000-0005-000000000013', 'Leg Extension',    '00000000-0000-0000-0003-000000000008', 3, 12, 2),
  ('00000000-0000-0000-0006-000000000109', '00000000-0000-0000-0005-000000000013', 'Leg Curl',         '00000000-0000-0000-0003-000000000009', 3, 12, 3),
  -- PPL / Push B
  ('00000000-0000-0000-0006-000000000110', '00000000-0000-0000-0005-000000000014', 'Cable Crossover',  '00000000-0000-0000-0003-000000000003', 3, 12, 1),
  ('00000000-0000-0000-0006-000000000111', '00000000-0000-0000-0005-000000000014', 'Smith Bench Press','00000000-0000-0000-0003-000000000019', 4, 8,  2),
  -- PPL / Pull B
  ('00000000-0000-0000-0006-000000000112', '00000000-0000-0000-0005-000000000015', 'Low Cable Row',    '00000000-0000-0000-0003-000000000006', 4, 10, 1),
  ('00000000-0000-0000-0006-000000000113', '00000000-0000-0000-0005-000000000015', 'Rowing Machine',   '00000000-0000-0000-0003-000000000017', 1, 1,  2),
  -- PPL / Legs B
  ('00000000-0000-0000-0006-000000000114', '00000000-0000-0000-0005-000000000016', 'Smith Squat',      '00000000-0000-0000-0003-000000000019', 4, 8,  1),
  ('00000000-0000-0000-0006-000000000115', '00000000-0000-0000-0005-000000000016', 'Hip Abductor',     '00000000-0000-0000-0003-000000000010', 3, 15, 2),
  -- Full Body 1
  ('00000000-0000-0000-0006-000000000201', '00000000-0000-0000-0005-000000000021', 'Chest Press',      '00000000-0000-0000-0003-000000000001', 3, 10, 1),
  ('00000000-0000-0000-0006-000000000202', '00000000-0000-0000-0005-000000000021', 'Lat Pulldown',     '00000000-0000-0000-0003-000000000004', 3, 10, 2),
  ('00000000-0000-0000-0006-000000000203', '00000000-0000-0000-0005-000000000021', 'Leg Press',        '00000000-0000-0000-0003-000000000007', 3, 12, 3),
  -- Full Body 2
  ('00000000-0000-0000-0006-000000000204', '00000000-0000-0000-0005-000000000022', 'Overhead Press',   '00000000-0000-0000-0003-000000000002', 3, 10, 1),
  ('00000000-0000-0000-0006-000000000205', '00000000-0000-0000-0005-000000000022', 'Seated Row',       '00000000-0000-0000-0003-000000000005', 3, 10, 2),
  ('00000000-0000-0000-0006-000000000206', '00000000-0000-0000-0005-000000000022', 'Leg Curl',         '00000000-0000-0000-0003-000000000009', 3, 12, 3),
  -- Full Body 3
  ('00000000-0000-0000-0006-000000000207', '00000000-0000-0000-0005-000000000023', 'Cable Crossover',  '00000000-0000-0000-0003-000000000003', 3, 12, 1),
  ('00000000-0000-0000-0006-000000000208', '00000000-0000-0000-0005-000000000023', 'Ab Crunch',        '00000000-0000-0000-0003-000000000013', 3, 15, 2),
  ('00000000-0000-0000-0006-000000000209', '00000000-0000-0000-0005-000000000023', 'Leg Extension',    '00000000-0000-0000-0003-000000000008', 3, 12, 3),
  -- Circuit days
  ('00000000-0000-0000-0006-000000000301', '00000000-0000-0000-0005-000000000031', 'Chest Press',      '00000000-0000-0000-0003-000000000001', 3, 12, 1),
  ('00000000-0000-0000-0006-000000000302', '00000000-0000-0000-0005-000000000031', 'Seated Row',       '00000000-0000-0000-0003-000000000005', 3, 12, 2),
  ('00000000-0000-0000-0006-000000000303', '00000000-0000-0000-0005-000000000032', 'Leg Press',        '00000000-0000-0000-0003-000000000007', 3, 15, 1),
  ('00000000-0000-0000-0006-000000000304', '00000000-0000-0000-0005-000000000032', 'Hip Abductor',     '00000000-0000-0000-0003-000000000010', 3, 15, 2),
  ('00000000-0000-0000-0006-000000000305', '00000000-0000-0000-0005-000000000033', 'Tricep Pushdown',  '00000000-0000-0000-0003-000000000012', 3, 12, 1),
  ('00000000-0000-0000-0006-000000000306', '00000000-0000-0000-0005-000000000033', 'Bicep Curl',       '00000000-0000-0000-0003-000000000011', 3, 12, 2),
  ('00000000-0000-0000-0006-000000000307', '00000000-0000-0000-0005-000000000034', 'Treadmill Intervals', '00000000-0000-0000-0003-000000000014', 1, 1, 1),
  ('00000000-0000-0000-0006-000000000308', '00000000-0000-0000-0005-000000000034', 'Ab Crunch',        '00000000-0000-0000-0003-000000000013', 3, 15, 2)
ON CONFLICT (id) DO NOTHING;

-- Template assignments (trainer-built programs → members)
INSERT INTO public.member_program_assignments (id, member_id, program_id, ai_program_id, assigned_by, assigned_at, status) VALUES
  (md5('nx-mpa-1')::uuid, '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0004-000000000001', NULL, '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '35 days', 'active'),
  (md5('nx-mpa-2')::uuid, '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0004-000000000002', NULL, '00000000-0000-0000-0002-000000000002', NOW() - INTERVAL '28 days', 'active'),
  (md5('nx-mpa-3')::uuid, '00000000-0000-0000-0001-000000000018', '00000000-0000-0000-0004-000000000002', NULL, '00000000-0000-0000-0002-000000000002', NOW() - INTERVAL '21 days', 'active'),
  (md5('nx-mpa-4')::uuid, '00000000-0000-0000-0001-000000000028', '00000000-0000-0000-0004-000000000003', NULL, '00000000-0000-0000-0002-000000000003', NOW() - INTERVAL '14 days', 'active')
ON CONFLICT (id) DO NOTHING;

-- AI PROGRAM for Carlos — the one that powers TodayZone in every demo.
-- program_data.days shape matches /api/programs/active expectations.
INSERT INTO public.ai_programs (
  id, member_id, gym_id, title, description, goal, experience_level,
  duration_weeks, sessions_per_week, focus, program_data,
  week_number, day_number, sessions_completed, sessions_total,
  prs_hit, total_volume_lbs, on_track, generated_by, is_active, created_at
) VALUES (
  '00000000-0000-0000-0004-000000000101',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'AI Muscle Builder — Upper/Lower',
  'Personalized 4-week program. Intermediate level, 4 days/week upper-lower split focused on progressive overload.',
  'muscle-gain', 'intermediate',
  4, 4, 'hypertrophy',
  '{
    "days": [
      {"day_number": 1, "name": "Upper A — Push Focus", "exercises": [
        {"exercise_name": "Chest Press",     "machine_id": "00000000-0000-0000-0003-000000000001", "default_sets": 4, "default_reps": 10},
        {"exercise_name": "Overhead Press",  "machine_id": "00000000-0000-0000-0003-000000000002", "default_sets": 3, "default_reps": 10},
        {"exercise_name": "Cable Flyes",     "machine_id": "00000000-0000-0000-0003-000000000003", "default_sets": 3, "default_reps": 12},
        {"exercise_name": "Tricep Pushdown", "machine_id": "00000000-0000-0000-0003-000000000012", "default_sets": 3, "default_reps": 12}
      ]},
      {"day_number": 2, "name": "Lower A — Quad Focus", "exercises": [
        {"exercise_name": "Leg Press",     "machine_id": "00000000-0000-0000-0003-000000000007", "default_sets": 4, "default_reps": 10},
        {"exercise_name": "Leg Extension", "machine_id": "00000000-0000-0000-0003-000000000008", "default_sets": 3, "default_reps": 12},
        {"exercise_name": "Ab Crunch",     "machine_id": "00000000-0000-0000-0003-000000000013", "default_sets": 3, "default_reps": 15}
      ]},
      {"day_number": 3, "name": "Upper B — Pull Focus", "exercises": [
        {"exercise_name": "Lat Pulldown", "machine_id": "00000000-0000-0000-0003-000000000004", "default_sets": 4, "default_reps": 10},
        {"exercise_name": "Seated Row",   "machine_id": "00000000-0000-0000-0003-000000000005", "default_sets": 3, "default_reps": 10},
        {"exercise_name": "Bicep Curl",   "machine_id": "00000000-0000-0000-0003-000000000011", "default_sets": 3, "default_reps": 12}
      ]},
      {"day_number": 4, "name": "Lower B — Hamstring Focus", "exercises": [
        {"exercise_name": "Leg Curl",     "machine_id": "00000000-0000-0000-0003-000000000009", "default_sets": 4, "default_reps": 12},
        {"exercise_name": "Hip Abductor", "machine_id": "00000000-0000-0000-0003-000000000010", "default_sets": 3, "default_reps": 15},
        {"exercise_name": "Smith Squat",  "machine_id": "00000000-0000-0000-0003-000000000019", "default_sets": 3, "default_reps": 10}
      ]}
    ]
  }'::jsonb,
  2, 1, 5, 16,
  2, 48500, true, 'ai', true, NOW() - INTERVAL '14 days'
) ON CONFLICT (id) DO NOTHING;

-- 8 more AI programs (simple 3-day rotations) for a mix of members
DO $$
DECLARE
  v_targets CONSTANT integer[] := ARRAY[1, 2, 5, 6, 14, 15, 16, 27];
  v_titles  CONSTANT text[] := ARRAY[
    'AI Strength Block', 'AI Balanced Builder', 'AI Starter Plan', 'AI Comeback Plan',
    'AI Hypertrophy Block', 'AI Conditioning Mix', 'AI Strength Foundations', 'AI Consistency Plan'
  ];
  k integer;
  v_mid uuid;
  v_m RECORD;
BEGIN
  FOR k IN 1..8 LOOP
    v_mid := ('00000000-0000-0000-0001-' || lpad(v_targets[k]::text, 12, '0'))::uuid;
    SELECT primary_goal, experience_level, created_at INTO v_m FROM public.members WHERE id = v_mid;
    CONTINUE WHEN NOT FOUND;
    INSERT INTO public.ai_programs (
      id, member_id, gym_id, title, description, goal, experience_level,
      duration_weeks, sessions_per_week, program_data,
      week_number, day_number, sessions_completed, sessions_total,
      generated_by, is_active, created_at
    ) VALUES (
      ('00000000-0000-0000-0004-' || lpad((101 + k)::text, 12, '0'))::uuid,
      v_mid,
      '00000000-0000-0000-0000-000000000001',
      v_titles[k],
      'AI-generated 4-week plan tuned to goal and experience level.',
      COALESCE(v_m.primary_goal, 'general-fitness'),
      COALESCE(v_m.experience_level, 'beginner'),
      4, 3,
      jsonb_build_object('days', jsonb_build_array(
        jsonb_build_object('day_number', 1, 'name', 'Push Day', 'exercises', jsonb_build_array(
          jsonb_build_object('exercise_name', 'Chest Press',    'machine_id', '00000000-0000-0000-0003-000000000001', 'default_sets', 3, 'default_reps', 10),
          jsonb_build_object('exercise_name', 'Overhead Press', 'machine_id', '00000000-0000-0000-0003-000000000002', 'default_sets', 3, 'default_reps', 10)
        )),
        jsonb_build_object('day_number', 2, 'name', 'Pull Day', 'exercises', jsonb_build_array(
          jsonb_build_object('exercise_name', 'Lat Pulldown', 'machine_id', '00000000-0000-0000-0003-000000000004', 'default_sets', 3, 'default_reps', 10),
          jsonb_build_object('exercise_name', 'Seated Row',   'machine_id', '00000000-0000-0000-0003-000000000005', 'default_sets', 3, 'default_reps', 10)
        )),
        jsonb_build_object('day_number', 3, 'name', 'Leg Day', 'exercises', jsonb_build_array(
          jsonb_build_object('exercise_name', 'Leg Press', 'machine_id', '00000000-0000-0000-0003-000000000007', 'default_sets', 3, 'default_reps', 12),
          jsonb_build_object('exercise_name', 'Leg Curl',  'machine_id', '00000000-0000-0000-0003-000000000009', 'default_sets', 3, 'default_reps', 12)
        ))
      )),
      1 + (k % 3), 1 + (k % 3), 2 + k, 12,
      'ai',
      -- Members with a trainer template assignment keep the AI plan inactive
      (v_targets[k] NOT IN (1, 2, 18, 28)),
      GREATEST(v_m.created_at + INTERVAL '7 days', NOW() - INTERVAL '30 days')
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — WORKOUT SESSIONS (~1,000 over 90 days, progressive overload)
-- Adapted from DOC_04 to the real workout_sessions schema:
--   mode         → workout_mode ('ai_program'|'trainer_program'|'free';
--                                spec's 'freestyle' → 'free')
--   sets_data    → sets (entries shaped like the app writes them:
--                  {set_number, weight_lbs, reps, rpe, notes, logged_at})
--   total_volume → total_volume_lbs (+ sets_count/best_weight_lbs/best_reps,
--                  which the spec omitted but the schema requires for the UI)
--   no duration_seconds / status columns → completed_at marks completion
--   session_date (date, NOT NULL) added — required by every stats function
-- PRs are marked in a post-pass (below) exactly like /api/sessions/pr-check:
--   first ever session on a machine → 'first_session'; a session whose
--   best_weight_lbs beats all prior sessions on that machine → 'weight'.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  G CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  -- Machine pool (chest press listed twice so it lands as "most popular")
  v_pool CONSTANT uuid[] := ARRAY[
    '00000000-0000-0000-0003-000000000001'::uuid,  -- chest press  x1.00
    '00000000-0000-0000-0003-000000000004'::uuid,  -- lat pulldown x0.90
    '00000000-0000-0000-0003-000000000007'::uuid,  -- leg press    x2.00
    '00000000-0000-0000-0003-000000000008'::uuid,  -- leg ext      x0.80
    '00000000-0000-0000-0003-000000000009'::uuid,  -- leg curl     x0.80
    '00000000-0000-0000-0003-000000000011'::uuid,  -- bicep curl   x0.45
    '00000000-0000-0000-0003-000000000012'::uuid,  -- tricep push  x0.50
    '00000000-0000-0000-0003-000000000005'::uuid,  -- seated row   x0.90
    '00000000-0000-0000-0003-000000000001'::uuid,  -- chest press  x1.00
    '00000000-0000-0000-0003-000000000002'::uuid,  -- overhead     x0.65
    '00000000-0000-0000-0003-000000000013'::uuid,  -- ab crunch    x0.60
    '00000000-0000-0000-0003-000000000019'::uuid   -- smith        x1.20
  ];
  v_mult CONSTANT numeric[] := ARRAY[1.00,0.90,2.00,0.80,0.80,0.45,0.50,0.90,1.00,0.65,0.60,1.20];
  v_cardio CONSTANT uuid[] := ARRAY[
    '00000000-0000-0000-0003-000000000014'::uuid,
    '00000000-0000-0000-0003-000000000015'::uuid,
    '00000000-0000-0000-0003-000000000016'::uuid,
    '00000000-0000-0000-0003-000000000017'::uuid,
    '00000000-0000-0000-0003-000000000018'::uuid
  ];
  -- Carlos's 4-day rotation: chest press, leg press, lat pulldown, leg curl
  v_carlos_days CONSTANT uuid[] := ARRAY[
    '00000000-0000-0000-0003-000000000001'::uuid,
    '00000000-0000-0000-0003-000000000007'::uuid,
    '00000000-0000-0000-0003-000000000004'::uuid,
    '00000000-0000-0000-0003-000000000009'::uuid
  ];
  v_carlos_mult CONSTANT numeric[] := ARRAY[1.00, 2.00, 0.90, 0.80];

  i          integer;
  v_mid      uuid;
  v_m        RECORD;
  v_gap      integer;
  v_age      integer;
  v_spw      numeric;
  v_day      integer;
  h          integer;
  v_pick     integer;
  v_machine  uuid;
  v_wmult    numeric;
  v_base     numeric;
  v_weight   numeric;
  v_reps     integer;
  v_rpe      integer;
  v_nsets    integer;
  v_sets     jsonb;
  v_vol      numeric;
  v_best_w   numeric;
  v_best_r   integer;
  v_hour     integer;
  v_ts       timestamptz;
  v_mode     text;
  s          integer;
  v_prev     numeric;
BEGIN
  PERFORM setseed(0.42);

  FOR i IN 1..50 LOOP
    v_mid := ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid;
    SELECT id, smartgym_score, experience_level, last_session_date, created_at
      INTO v_m FROM public.members WHERE id = v_mid;
    CONTINUE WHEN NOT FOUND;

    v_gap := GREATEST(0, CURRENT_DATE - COALESCE(v_m.last_session_date, CURRENT_DATE));
    v_age := LEAST(89, CURRENT_DATE - v_m.created_at::date);
    v_spw := CASE
      WHEN i = 1 THEN 6            -- Marcus
      WHEN i IN (2, 3) THEN 4      -- Sofia, Carlos
      WHEN i = 4 THEN 2            -- Ana (history before she lapsed)
      WHEN i IN (5, 6) THEN 3      -- Jorge, Isabella
      WHEN i <= 13 THEN 5 + (abs(hashtext('spw' || i)) % 2)   -- power
      WHEN i <= 26 THEN 3 + (abs(hashtext('spw' || i)) % 2)   -- consistent
      WHEN i <= 37 THEN 1 + (abs(hashtext('spw' || i)) % 2)   -- casual
      WHEN i <= 44 THEN 2          -- at-risk (pre-lapse history)
      WHEN i <= 48 THEN 2          -- inactive (pre-lapse history)
      ELSE 3 END;                  -- new

    v_base := 55 + (v_m.smartgym_score / 80.0);

    FOR v_day IN 0..89 LOOP
      CONTINUE WHEN v_day < v_gap OR v_day > v_age;
      -- Isabella's comeback: a 3-week hole between day 4 and day 24
      CONTINUE WHEN i = 6 AND v_day BETWEEN 4 AND 24;
      h := abs(hashtext('nx-day-' || i || '-' || v_day));
      CONTINUE WHEN (h % 700) >= (v_spw * 100);

      -- Machine + weight multiplier
      IF i = 3 THEN
        v_pick    := 1 + (v_day % 4);
        v_machine := v_carlos_days[v_pick];
        v_wmult   := v_carlos_mult[v_pick];
      ELSIF (h % 10) = 0 THEN
        -- ~10% cardio sessions (no weights logged)
        v_machine := v_cardio[1 + (h % 5)];
        v_wmult   := 0;
      ELSE
        v_pick    := 1 + (h % 12);
        v_machine := v_pool[v_pick];
        v_wmult   := v_mult[v_pick];
      END IF;

      -- Peak-hour shaping: mornings 6-9, evenings 17-20, midday otherwise
      v_hour := CASE
        WHEN (h % 100) < 30 THEN 17 + (h % 4)
        WHEN (h % 100) < 55 THEN 6 + (h % 4)
        ELSE 9 + (h % 8) END;
      v_ts := (CURRENT_DATE - v_day)::timestamptz
              + make_interval(hours => v_hour, mins => (h % 60));

      v_mode := CASE
        WHEN i = 3 THEN 'ai_program'
        WHEN i IN (1, 2) THEN 'trainer_program'
        ELSE (ARRAY['free','ai_program','free'])[1 + (h % 3)] END;

      IF v_wmult = 0 THEN
        -- Cardio: session with no strength sets
        INSERT INTO public.workout_sessions (
          id, gym_id, machine_id, member_id, session_date, workout_mode,
          sets, sets_count, total_volume_lbs, completed_at, created_at
        ) VALUES (
          md5('nx-sess-' || i || '-' || v_day)::uuid, G, v_machine, v_mid,
          CURRENT_DATE - v_day, v_mode,
          '[]'::jsonb, 0, 0, v_ts + INTERVAL '35 minutes', v_ts
        ) ON CONFLICT (id) DO NOTHING;
        CONTINUE;
      END IF;

      -- Progressive overload: older sessions are lighter
      v_weight := ROUND((v_base * v_wmult * (1 - v_day / 450.0)) / 5) * 5;
      v_weight := GREATEST(v_weight, 15);

      v_sets   := '[]'::jsonb;
      v_vol    := 0;
      v_best_w := 0;
      v_best_r := 0;
      v_nsets  := 3 + (h % 3);
      FOR s IN 1..v_nsets LOOP
        v_reps := 8 + ((h + s * 13) % 5);
        v_rpe  := 6 + ((h + s * 7) % 4);
        v_sets := v_sets || jsonb_build_object(
          'set_number', s,
          'weight_lbs', v_weight,
          'reps',       v_reps,
          'rpe',        v_rpe,
          'notes',      NULL,
          'logged_at',  (v_ts + (s * 4 || ' minutes')::interval)
        );
        v_vol    := v_vol + v_weight * v_reps;
        v_best_w := GREATEST(v_best_w, v_weight);
        v_best_r := GREATEST(v_best_r, v_reps);
      END LOOP;

      INSERT INTO public.workout_sessions (
        id, gym_id, machine_id, member_id, session_date, workout_mode,
        sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps,
        completed_at, created_at
      ) VALUES (
        md5('nx-sess-' || i || '-' || v_day)::uuid, G, v_machine, v_mid,
        CURRENT_DATE - v_day, v_mode,
        v_sets, v_nsets, v_vol, v_best_w, v_best_r,
        v_ts + INTERVAL '40 minutes', v_ts
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Carlos's guaranteed YESTERDAY chest-press session, 5 lbs above his best —
  -- the PR pass marks it, and beating it live triggers the PR celebration
  -- (DOC_04 Scenario B). Carlos deliberately has NO session today.
  SELECT COALESCE(MAX(best_weight_lbs), 90) INTO v_prev
  FROM public.workout_sessions
  WHERE member_id = '00000000-0000-0000-0001-000000000003'
    AND machine_id = '00000000-0000-0000-0003-000000000001'
    AND id <> md5('nx-sess-carlos-yesterday')::uuid;
  v_weight := (CEIL((v_prev + 5) / 5) * 5);
  v_ts := (CURRENT_DATE - 1)::timestamptz + INTERVAL '18 hours';
  v_sets := jsonb_build_array(
    jsonb_build_object('set_number', 1, 'weight_lbs', v_weight - 10, 'reps', 10, 'rpe', 7, 'notes', NULL, 'logged_at', v_ts + INTERVAL '4 minutes'),
    jsonb_build_object('set_number', 2, 'weight_lbs', v_weight - 5,  'reps', 9,  'rpe', 8, 'notes', NULL, 'logged_at', v_ts + INTERVAL '9 minutes'),
    jsonb_build_object('set_number', 3, 'weight_lbs', v_weight,      'reps', 8,  'rpe', 9, 'notes', NULL, 'logged_at', v_ts + INTERVAL '14 minutes'),
    jsonb_build_object('set_number', 4, 'weight_lbs', v_weight,      'reps', 7,  'rpe', 9, 'notes', NULL, 'logged_at', v_ts + INTERVAL '19 minutes')
  );
  INSERT INTO public.workout_sessions (
    id, gym_id, machine_id, member_id, session_date, workout_mode,
    sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps,
    completed_at, created_at
  ) VALUES (
    md5('nx-sess-carlos-yesterday')::uuid, G,
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000003',
    CURRENT_DATE - 1, 'ai_program',
    v_sets, 4,
    (v_weight - 10) * 10 + (v_weight - 5) * 9 + v_weight * 8 + v_weight * 7,
    v_weight, 10,
    v_ts + INTERVAL '24 minutes', v_ts
  ) ON CONFLICT (id) DO NOTHING;

  -- "Happening now" sessions so the owner live-activity strip is never empty
  INSERT INTO public.workout_sessions (
    id, gym_id, machine_id, member_id, session_date, workout_mode,
    sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps,
    completed_at, created_at
  ) VALUES
    (md5('nx-sess-live-1')::uuid, G, '00000000-0000-0000-0003-000000000001',
     '00000000-0000-0000-0001-000000000001', CURRENT_DATE, 'trainer_program',
     jsonb_build_array(jsonb_build_object('set_number',1,'weight_lbs',205,'reps',8,'rpe',8,'notes',NULL,'logged_at',NOW() - INTERVAL '40 minutes')),
     1, 1640, 205, 8, NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '45 minutes'),
    (md5('nx-sess-live-2')::uuid, G, '00000000-0000-0000-0003-000000000007',
     '00000000-0000-0000-0001-000000000008', CURRENT_DATE, 'free',
     jsonb_build_array(jsonb_build_object('set_number',1,'weight_lbs',270,'reps',10,'rpe',7,'notes',NULL,'logged_at',NOW() - INTERVAL '75 minutes')),
     1, 2700, 270, 10, NOW() - INTERVAL '70 minutes', NOW() - INTERVAL '80 minutes'),
    (md5('nx-sess-live-3')::uuid, G, '00000000-0000-0000-0003-000000000004',
     '00000000-0000-0000-0001-000000000002', CURRENT_DATE, 'trainer_program',
     jsonb_build_array(jsonb_build_object('set_number',1,'weight_lbs',105,'reps',10,'rpe',7,'notes',NULL,'logged_at',NOW() - INTERVAL '105 minutes')),
     1, 1050, 105, 10, NOW() - INTERVAL '100 minutes', NOW() - INTERVAL '110 minutes')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- PR POST-PASS — mirrors /api/sessions/pr-check semantics.
-- 1) 'weight' PRs: best_weight_lbs beats every earlier session on the machine
UPDATE public.workout_sessions ws SET
  is_personal_best   = true,
  personal_best_type = 'weight',
  previous_best_lbs  = sub.prev_max,
  pr_improvement_lbs = ws.best_weight_lbs - sub.prev_max,
  pr_improvement_pct = ROUND(((ws.best_weight_lbs - sub.prev_max) / sub.prev_max) * 100, 2)
FROM (
  SELECT id,
         best_weight_lbs,
         MAX(best_weight_lbs) OVER (
           PARTITION BY member_id, machine_id
           ORDER BY session_date, created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ) AS prev_max
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
    AND best_weight_lbs IS NOT NULL AND best_weight_lbs > 0
) sub
WHERE ws.id = sub.id
  AND sub.prev_max IS NOT NULL AND sub.prev_max > 0
  AND sub.best_weight_lbs > sub.prev_max
  AND ws.is_personal_best = false;

-- 2) 'first_session' PRs: the first ever strength session on a machine
UPDATE public.workout_sessions ws SET
  is_personal_best   = true,
  personal_best_type = 'first_session'
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY member_id, machine_id
           ORDER BY session_date, created_at
         ) AS rn
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
    AND best_weight_lbs IS NOT NULL AND best_weight_lbs > 0
) sub
WHERE ws.id = sub.id AND sub.rn = 1 AND ws.is_personal_best = false;

-- Sync member activity columns with the generated history
UPDATE public.members m SET
  last_session_date = s.max_date,
  last_seen_at      = GREATEST(COALESCE(m.last_seen_at, s.max_ts), s.max_ts)
FROM (
  SELECT member_id, MAX(session_date) AS max_date, MAX(completed_at) AS max_ts
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  GROUP BY member_id
) s
WHERE m.id = s.member_id
  AND m.gym_id = '00000000-0000-0000-0000-000000000001';
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 — ACHIEVEMENTS (180+ earned)
-- Adapted from DOC_04: member_achievements uses achievement_code (FK to
-- achievement_definitions.code from supabase/seed.sql) — NOT achievement_id,
-- and there is no points_awarded column (points live on the definition).
-- Real categories: milestone|performance|consistency|explorer|community.
-- ─────────────────────────────────────────────────────────────────────────────

-- Marcus — 19 achievements (power user wall)
INSERT INTO public.member_achievements (member_id, gym_id, achievement_code, earned_at)
SELECT '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', t.code, NOW() - (t.offs || ' days')::interval
FROM (VALUES
  ('first-scan', 113), ('sessions-10', 100), ('sessions-50', 55), ('sessions-100', 12),
  ('program-complete', 70), ('level-5', 78), ('first-pr', 108), ('prs-5', 88),
  ('prs-10', 60), ('prs-25', 20), ('volume-10k', 95), ('volume-100k', 30),
  ('streak-3', 110), ('streak-7', 104), ('streak-14', 97), ('streak-30', 80),
  ('machines-3', 109), ('machines-10', 85), ('challenge-win', 15)
) AS t(code, offs)
ON CONFLICT (member_id, achievement_code) DO NOTHING;

-- Sofia — 10 achievements
INSERT INTO public.member_achievements (member_id, gym_id, achievement_code, earned_at)
SELECT '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', t.code, NOW() - (t.offs || ' days')::interval
FROM (VALUES
  ('first-scan', 98), ('sessions-10', 82), ('sessions-50', 25), ('first-pr', 90),
  ('prs-5', 45), ('volume-10k', 70), ('streak-3', 92), ('streak-7', 84),
  ('machines-3', 95), ('challenge-join', 24)
) AS t(code, offs)
ON CONFLICT (member_id, achievement_code) DO NOTHING;

-- Carlos — 6 achievements (demo achievement wall)
INSERT INTO public.member_achievements (member_id, gym_id, achievement_code, earned_at)
SELECT '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', t.code, NOW() - (t.offs || ' days')::interval
FROM (VALUES
  ('first-scan', 88), ('sessions-10', 70), ('first-pr', 75),
  ('streak-7', 40), ('machines-3', 82), ('volume-10k', 35)
) AS t(code, offs)
ON CONFLICT (member_id, achievement_code) DO NOTHING;

-- Ana / Jorge / Isabella — small sets
INSERT INTO public.member_achievements (member_id, gym_id, achievement_code, earned_at)
SELECT m.mid::uuid, '00000000-0000-0000-0000-000000000001', m.code, NOW() - (m.offs || ' days')::interval
FROM (VALUES
  ('00000000-0000-0000-0001-000000000004', 'first-scan', 72),
  ('00000000-0000-0000-0001-000000000004', 'sessions-10', 45),
  ('00000000-0000-0000-0001-000000000005', 'first-scan', 7),
  ('00000000-0000-0000-0001-000000000006', 'first-scan', 82),
  ('00000000-0000-0000-0001-000000000006', 'sessions-10', 60),
  ('00000000-0000-0000-0001-000000000006', 'streak-3', 55)
) AS m(mid, code, offs)
ON CONFLICT (member_id, achievement_code) DO NOTHING;

-- Bulk members 07-50: 2-7 achievements each, drawn from starter codes
DO $$
DECLARE
  v_m RECORD;
  v_count integer;
BEGIN
  FOR v_m IN
    SELECT id, created_at FROM public.members
    WHERE gym_id = '00000000-0000-0000-0000-000000000001'
      AND id::text LIKE '00000000-0000-0000-0001-%'
      AND id > '00000000-0000-0000-0001-000000000006'::uuid
  LOOP
    v_count := 2 + (abs(hashtext(v_m.id::text)) % 6);
    INSERT INTO public.member_achievements (member_id, gym_id, achievement_code, earned_at)
    SELECT v_m.id, '00000000-0000-0000-0000-000000000001', x.code,
           LEAST(NOW() - INTERVAL '1 day',
                 v_m.created_at + (x.rn * INTERVAL '11 days'))
    FROM (
      SELECT ad.code, ROW_NUMBER() OVER (ORDER BY ad.sort_order) AS rn
      FROM public.achievement_definitions ad
      WHERE ad.code IN ('first-scan','sessions-10','streak-3','streak-7',
                        'machines-3','first-pr','volume-10k','challenge-join')
      ORDER BY ad.sort_order
      LIMIT v_count
    ) x
    ON CONFLICT (member_id, achievement_code) DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8 — LEADERBOARDS
-- Adapted from DOC_04: member_leaderboard_positions is one row PER TYPE
-- ('volume-weekly'|'sessions-weekly'|'prs-monthly'|'streak-live'|
--  'score-alltime') with current_rank/previous_rank/current_value — not one
-- row with 5 rank columns. Values are computed from the REAL seeded sessions.
-- leaderboard_snapshots key = (gym_id, leaderboard_type, snapshot_date) with
-- a rankings jsonb array — not week_start/week_end columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- score-alltime
INSERT INTO public.member_leaderboard_positions
  (member_id, gym_id, leaderboard_type, current_rank, previous_rank, current_value)
SELECT id, '00000000-0000-0000-0000-000000000001', 'score-alltime',
       ROW_NUMBER() OVER (ORDER BY smartgym_score DESC),
       GREATEST(1, ROW_NUMBER() OVER (ORDER BY smartgym_score DESC)::int + ((abs(hashtext(id::text)) % 3) - 1)),
       smartgym_score
FROM public.members
WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND is_active = true
ON CONFLICT (member_id, gym_id, leaderboard_type) DO UPDATE
  SET current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      current_value = EXCLUDED.current_value,
      updated_at = NOW();

-- streak-live
INSERT INTO public.member_leaderboard_positions
  (member_id, gym_id, leaderboard_type, current_rank, previous_rank, current_value)
SELECT id, '00000000-0000-0000-0000-000000000001', 'streak-live',
       ROW_NUMBER() OVER (ORDER BY current_streak DESC, smartgym_score DESC),
       ROW_NUMBER() OVER (ORDER BY current_streak DESC, smartgym_score DESC),
       current_streak
FROM public.members
WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND is_active = true
ON CONFLICT (member_id, gym_id, leaderboard_type) DO UPDATE
  SET current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      current_value = EXCLUDED.current_value,
      updated_at = NOW();

-- volume-weekly (from real sessions, last 7 days)
INSERT INTO public.member_leaderboard_positions
  (member_id, gym_id, leaderboard_type, current_rank, previous_rank, current_value)
SELECT member_id, '00000000-0000-0000-0000-000000000001', 'volume-weekly',
       ROW_NUMBER() OVER (ORDER BY vol DESC),
       GREATEST(1, ROW_NUMBER() OVER (ORDER BY vol DESC)::int + ((abs(hashtext(member_id::text)) % 5) - 2)),
       vol
FROM (
  SELECT member_id, SUM(total_volume_lbs) AS vol
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
    AND session_date >= CURRENT_DATE - 7
  GROUP BY member_id
) s
ON CONFLICT (member_id, gym_id, leaderboard_type) DO UPDATE
  SET current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      current_value = EXCLUDED.current_value,
      updated_at = NOW();

-- sessions-weekly
INSERT INTO public.member_leaderboard_positions
  (member_id, gym_id, leaderboard_type, current_rank, previous_rank, current_value)
SELECT member_id, '00000000-0000-0000-0000-000000000001', 'sessions-weekly',
       ROW_NUMBER() OVER (ORDER BY cnt DESC),
       ROW_NUMBER() OVER (ORDER BY cnt DESC),
       cnt
FROM (
  SELECT member_id, COUNT(*)::numeric AS cnt
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
    AND session_date >= CURRENT_DATE - 7
  GROUP BY member_id
) s
ON CONFLICT (member_id, gym_id, leaderboard_type) DO UPDATE
  SET current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      current_value = EXCLUDED.current_value,
      updated_at = NOW();

-- prs-monthly
INSERT INTO public.member_leaderboard_positions
  (member_id, gym_id, leaderboard_type, current_rank, previous_rank, current_value)
SELECT member_id, '00000000-0000-0000-0000-000000000001', 'prs-monthly',
       ROW_NUMBER() OVER (ORDER BY prs DESC),
       ROW_NUMBER() OVER (ORDER BY prs DESC),
       prs
FROM (
  SELECT member_id, COUNT(*) FILTER (WHERE is_personal_best)::numeric AS prs
  FROM public.workout_sessions
  WHERE gym_id = '00000000-0000-0000-0000-000000000001'
    AND session_date >= CURRENT_DATE - 30
  GROUP BY member_id
) s
ON CONFLICT (member_id, gym_id, leaderboard_type) DO UPDATE
  SET current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      current_value = EXCLUDED.current_value,
      updated_at = NOW();

-- 12 weekly snapshots x 2 types for trend charts
DO $$
DECLARE
  v_week integer;
BEGIN
  FOR v_week IN 0..11 LOOP
    INSERT INTO public.leaderboard_snapshots (gym_id, leaderboard_type, snapshot_date, rankings)
    SELECT
      '00000000-0000-0000-0000-000000000001',
      'score-alltime',
      (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval)::date,
      (SELECT jsonb_agg(jsonb_build_object(
                'member_id', x.id, 'display_name', x.display_name,
                'score', x.s, 'rank', x.rn))
       FROM (
         SELECT id, display_name,
                GREATEST(0, smartgym_score - v_week * 120
                            - (abs(hashtext(id::text || v_week)) % 200)) AS s,
                ROW_NUMBER() OVER (ORDER BY
                  GREATEST(0, smartgym_score - v_week * 120
                              - (abs(hashtext(id::text || v_week)) % 200)) DESC) AS rn
         FROM public.members
         WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND is_active = true
         ORDER BY s DESC
         LIMIT 20
       ) x)
    ON CONFLICT (gym_id, leaderboard_type, snapshot_date) DO NOTHING;

    INSERT INTO public.leaderboard_snapshots (gym_id, leaderboard_type, snapshot_date, rankings)
    SELECT
      '00000000-0000-0000-0000-000000000001',
      'volume-weekly',
      (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval)::date,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
                  'member_id', x.member_id, 'display_name', x.display_name,
                  'volume_lbs', x.vol, 'rank', x.rn))
         FROM (
           SELECT ws.member_id, m.display_name,
                  SUM(ws.total_volume_lbs)::int AS vol,
                  ROW_NUMBER() OVER (ORDER BY SUM(ws.total_volume_lbs) DESC) AS rn
           FROM public.workout_sessions ws
           JOIN public.members m ON m.id = ws.member_id
           WHERE ws.gym_id = '00000000-0000-0000-0000-000000000001'
             AND ws.session_date >= (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval)::date
             AND ws.session_date <  (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval)::date + 7
           GROUP BY ws.member_id, m.display_name
           ORDER BY vol DESC
           LIMIT 20
         ) x),
        '[]'::jsonb)
    ON CONFLICT (gym_id, leaderboard_type, snapshot_date) DO NOTHING;
  END LOOP;
END $$;
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9 — CHALLENGES (6, all types represented)
-- Adapted from DOC_04: gym_challenges uses title (not name), challenge_type
-- 'machine_explorer' (not 'explorer'), is_active/completed_at/winner_* (no
-- status column), and has NO target_value/unit columns — targets are folded
-- into the description. challenge_participants uses current_score (not
-- current_value) and has no status column.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.gym_challenges (
  id, gym_id, created_by, title, description, challenge_type,
  start_date, end_date, entry_mode, prize_type, prize_description,
  is_active, winner_member_id, winner_name, completed_at, created_at
) VALUES
  ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'Volume King',
   'Log the most total volume (sets x reps x weight) this month. Target: 100,000 lbs. Any machine counts.',
   'volume',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   'open', 'membership', 'Free month of membership',
   true, NULL, NULL, NULL, date_trunc('month', CURRENT_DATE)),
  ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000002',
   '20 Sessions This Month',
   'Complete 20 gym sessions before the month ends. Every scan counts.',
   'sessions',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   'open', 'merch', 'Iron Society water bottle + shaker',
   true, NULL, NULL, NULL, date_trunc('month', CURRENT_DATE)),
  ('00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'Machine Explorer',
   'Use at least 10 different machines this month. Discover new exercises.',
   'machine_explorer',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   'open', 'merch', 'Nexera branded towel',
   true, NULL, NULL, NULL, date_trunc('month', CURRENT_DATE)),
  ('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000003',
   'PR Hunter',
   'Hit 5 personal records this month. Any weight PR on any machine.',
   'pr',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   'opt-in', 'service', 'Personal training session',
   true, NULL, NULL, NULL, date_trunc('month', CURRENT_DATE)),
  ('00000000-0000-0000-0007-000000000005', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000002',
   'Consistency Club',
   'Train at least 3 days every week for the entire month. 4 weeks straight.',
   'streak',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   'open', 'recognition', 'Featured on the gym leaderboard + badge',
   true, NULL, NULL, NULL, date_trunc('month', CURRENT_DATE)),
  -- Completed last month — Marcus won
  ('00000000-0000-0000-0007-000000000006', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'Strength Week',
   'Who lifted the most total weight in the final week of last month? Target: 50,000 lbs.',
   'volume',
   (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date,
   (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date,
   'open', 'merch', 'Champion t-shirt',
   false,
   '00000000-0000-0000-0001-000000000001', 'Marcus Rodriguez',
   date_trunc('month', CURRENT_DATE) - INTERVAL '1 day',
   date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- Participants for the 5 active challenges (~55% of active members each)
INSERT INTO public.challenge_participants
  (challenge_id, member_id, gym_id, current_score, current_rank, joined_at)
SELECT challenge_id, member_id, '00000000-0000-0000-0000-000000000001',
       score,
       ROW_NUMBER() OVER (PARTITION BY challenge_id ORDER BY score DESC),
       joined
FROM (
  SELECT c.id AS challenge_id, m.id AS member_id,
    (CASE c.challenge_type
       WHEN 'volume'           THEN 5000 + (abs(hashtext(c.id::text || m.id::text)) % 70000)
       WHEN 'sessions'         THEN abs(hashtext(c.id::text || m.id::text)) % 18
       WHEN 'machine_explorer' THEN 1 + (abs(hashtext(c.id::text || m.id::text)) % 11)
       WHEN 'pr'               THEN abs(hashtext(c.id::text || m.id::text)) % 6
       WHEN 'streak'           THEN abs(hashtext(c.id::text || m.id::text)) % 5
       ELSE abs(hashtext(c.id::text || m.id::text)) % 100
     END)::numeric AS score,
    c.start_date::timestamptz
      + ((abs(hashtext(m.id::text)) % 5) || ' days')::interval
      + ((abs(hashtext(m.id::text)) % 12) || ' hours')::interval AS joined
  FROM public.gym_challenges c
  JOIN public.members m ON m.gym_id = c.gym_id
  WHERE c.gym_id = '00000000-0000-0000-0000-000000000001'
    AND c.is_active = true
    AND m.is_active = true
    AND m.id::text LIKE '00000000-0000-0000-0001-%'
    AND m.last_session_date >= CURRENT_DATE - 14
    AND (abs(hashtext(c.id::text || '-' || m.id::text)) % 100) < 55
) t
ON CONFLICT (challenge_id, member_id) DO NOTHING;

-- Carlos is guaranteed into the Volume King challenge at 38,500 lbs
INSERT INTO public.challenge_participants
  (challenge_id, member_id, gym_id, current_score, current_rank, joined_at)
VALUES (
  '00000000-0000-0000-0007-000000000001',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000001',
  38500, 5, NOW() - INTERVAL '20 days'
)
ON CONFLICT (challenge_id, member_id) DO UPDATE
  SET current_score = 38500;

-- Completed challenge: 12 finishers, Marcus forced to rank 1
INSERT INTO public.challenge_participants
  (challenge_id, member_id, gym_id, current_score, current_rank, final_rank, joined_at)
SELECT '00000000-0000-0000-0007-000000000006', member_id,
       '00000000-0000-0000-0000-000000000001',
       score,
       ROW_NUMBER() OVER (ORDER BY score DESC),
       ROW_NUMBER() OVER (ORDER BY score DESC),
       (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')
         + ((abs(hashtext(member_id::text)) % 3) || ' days')::interval
FROM (
  SELECT m.id AS member_id,
         CASE WHEN m.id = '00000000-0000-0000-0001-000000000001'::uuid
              THEN 52000::numeric
              ELSE (3000 + (abs(hashtext('sw' || m.id::text)) % 45000))::numeric
         END AS score
  FROM public.members m
  WHERE m.gym_id = '00000000-0000-0000-0000-000000000001'
    AND m.id::text LIKE '00000000-0000-0000-0001-%'
    AND (m.id = '00000000-0000-0000-0001-000000000001'::uuid
         OR (abs(hashtext('swpick' || m.id::text)) % 100) < 25)
  ORDER BY (m.id = '00000000-0000-0000-0001-000000000001'::uuid) DESC, m.id
  LIMIT 12
) t
ON CONFLICT (challenge_id, member_id) DO NOTHING;

-- Keep top_score in sync
UPDATE public.gym_challenges c
SET top_score = COALESCE(s.max_score, 0)
FROM (
  SELECT challenge_id, MAX(current_score) AS max_score
  FROM public.challenge_participants
  GROUP BY challenge_id
) s
WHERE c.id = s.challenge_id
  AND c.gym_id = '00000000-0000-0000-0000-000000000001';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10 — SOCIAL FEED (200+ events, reactions, comments)
-- Adapted from DOC_04:
--   * display_text is NOT NULL in the real schema (spec omitted it) and must
--     NOT include the member's name — the UI renders the bold name span
--     separately (see lib/feed/formatFeedEvent.ts).
--   * event_data → context_data; 'achievement_unlocked' → 'achievement_earned'.
--   * pr_weight context carries best_weight_lbs / previous_best_lbs (the
--     fields formatFeedEvent reads), unit 'lbs'.
--   * reaction 'lets_go' → 'letsgo'; feed_reactions.reacted_at (not created_at)
--   * feed_comments.comment_text (not content).
-- ─────────────────────────────────────────────────────────────────────────────

-- PR events straight from the real PR sessions (last 30 days, up to 70)
INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at)
SELECT
  md5('nx-feed-pr-' || ws.id)::uuid,
  '00000000-0000-0000-0000-000000000001',
  ws.member_id,
  'pr_weight',
  'hit a new personal best on ' || mc.name || ' — ' || ws.best_weight_lbs::int || ' lbs!',
  jsonb_build_object(
    'machine_name', mc.name,
    'best_weight_lbs', ws.best_weight_lbs,
    'previous_best_lbs', ws.previous_best_lbs,
    'improvement_lbs', ws.pr_improvement_lbs,
    'unit', 'lbs'
  ),
  'high',
  ws.completed_at
FROM public.workout_sessions ws
JOIN public.machines mc ON mc.id = ws.machine_id
WHERE ws.gym_id = '00000000-0000-0000-0000-000000000001'
  AND ws.is_personal_best = true
  AND ws.personal_best_type = 'weight'
  AND ws.completed_at >= NOW() - INTERVAL '30 days'
ORDER BY ws.completed_at DESC
LIMIT 70
ON CONFLICT (id) DO NOTHING;

-- Achievement events from real earned achievements (up to 80)
INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at)
SELECT
  md5('nx-feed-ach-' || ma.id)::uuid,
  '00000000-0000-0000-0000-000000000001',
  ma.member_id,
  'achievement_earned',
  'earned the "' || ad.title || '" badge',
  jsonb_build_object(
    'achievement_code', ad.code,
    'achievement_name', ad.title,
    'points', ad.points,
    'category', ad.category,
    'icon_name', ad.icon_name
  ),
  'medium',
  ma.earned_at
FROM public.member_achievements ma
JOIN public.achievement_definitions ad ON ad.code = ma.achievement_code
WHERE ma.gym_id = '00000000-0000-0000-0000-000000000001'
  AND ma.earned_at >= NOW() - INTERVAL '45 days'
ORDER BY ma.earned_at DESC
LIMIT 80
ON CONFLICT (id) DO NOTHING;

-- Streak milestones, level-ups (real get_member_level names), archetype change
INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at) VALUES
  (md5('nx-feed-streak-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'streak_milestone', 'is on an 11-week streak 🔥', '{"weeks": 11}', 'high', NOW() - INTERVAL '7 days'),
  (md5('nx-feed-streak-2')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002',
   'streak_milestone', 'is on a 6-week streak 🔥', '{"weeks": 6}', 'medium', NOW() - INTERVAL '5 days'),
  (md5('nx-feed-streak-3')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003',
   'streak_milestone', 'is on a 4-week streak 🔥', '{"weeks": 4}', 'medium', NOW() - INTERVAL '2 days'),
  (md5('nx-feed-level-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'level_up', 'reached Level 10 — Legend', '{"new_level": 10, "level_name": "Legend"}', 'high', NOW() - INTERVAL '14 days'),
  (md5('nx-feed-level-2')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002',
   'level_up', 'reached Level 8 — Elite', '{"new_level": 8, "level_name": "Elite"}', 'medium', NOW() - INTERVAL '10 days'),
  (md5('nx-feed-arch-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'archetype_change', 'evolved into The Warrior', '{"new_archetype": "warrior", "previous_archetype": "iron_regular"}', 'medium', NOW() - INTERVAL '21 days'),
  (md5('nx-feed-new-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000005',
   'new_member', 'joined Iron Society — welcome! 👋', '{}', 'low', NOW() - INTERVAL '8 days'),
  (md5('nx-feed-new-2')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000049',
   'new_member', 'joined Iron Society — welcome! 👋', '{}', 'low', NOW() - INTERVAL '9 days'),
  (md5('nx-feed-new-3')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000050',
   'new_member', 'joined Iron Society — welcome! 👋', '{}', 'low', NOW() - INTERVAL '6 days'),
  (md5('nx-feed-ann-1')::uuid, '00000000-0000-0000-0000-000000000001', NULL,
   'gym_announcement', 'New challenge lineup is live — check the Challenges tab and claim your spot! 🏆', '{}', 'high', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- Challenge lifecycle events
INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at)
SELECT
  md5('nx-feed-chl-' || c.id)::uuid,
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'challenge_launched',
  'New challenge: "' || c.title || '" — join now!',
  jsonb_build_object('challenge_id', c.id, 'challenge_name', c.title, 'challenge_type', c.challenge_type),
  'high',
  c.created_at
FROM public.gym_challenges c
WHERE c.gym_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at) VALUES
  (md5('nx-feed-chj-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'challenge_joined', 'joined the "Volume King" challenge', '{"challenge_name": "Volume King", "challenge_type": "volume"}', 'low', NOW() - INTERVAL '25 days'),
  (md5('nx-feed-chj-2')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003',
   'challenge_joined', 'joined the "Volume King" challenge', '{"challenge_name": "Volume King", "challenge_type": "volume"}', 'low', NOW() - INTERVAL '20 days'),
  (md5('nx-feed-chc-1')::uuid, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001',
   'challenge_complete', 'won the "Strength Week" challenge 🏆', '{"challenge_name": "Strength Week", "final_rank": 1}', 'high', date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Workout shares from recently-active members (share_status per DOC_26 shape)
INSERT INTO public.gym_feed_events
  (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at)
SELECT
  md5('nx-feed-share-' || m.id)::uuid,
  '00000000-0000-0000-0000-000000000001',
  m.id,
  'workout_share',
  'is training right now 💪',
  jsonb_build_object('share_status', 'training', 'machine_name', 'Leg Press'),
  'low',
  NOW() - ((abs(hashtext('sh' || m.id::text)) % 7) || ' days')::interval
        - ((abs(hashtext('shh' || m.id::text)) % 10) || ' hours')::interval
FROM public.members m
WHERE m.gym_id = '00000000-0000-0000-0000-000000000001'
  AND m.is_active = true
  AND m.id::text LIKE '00000000-0000-0000-0001-%'
  AND m.last_session_date >= CURRENT_DATE - 7
ORDER BY m.smartgym_score DESC
LIMIT 20
ON CONFLICT (id) DO NOTHING;

-- REACTIONS (~400+): deterministic ~8% of (event x active member) pairs
INSERT INTO public.feed_reactions (event_id, member_id, reaction_type, reacted_at)
SELECT
  fe.id,
  m.id,
  (ARRAY['strength','fire','champion','letsgo'])[1 + (abs(hashtext(fe.id::text || m.id::text)) % 4)],
  fe.created_at + ((1 + (abs(hashtext(m.id::text || fe.id::text)) % 240)) || ' minutes')::interval
FROM public.gym_feed_events fe
JOIN public.members m
  ON m.gym_id = fe.gym_id
WHERE fe.gym_id = '00000000-0000-0000-0000-000000000001'
  AND m.is_active = true
  AND m.id::text LIKE '00000000-0000-0000-0001-%'
  AND m.last_session_date >= CURRENT_DATE - 10
  AND fe.member_id IS DISTINCT FROM m.id
  AND (abs(hashtext(fe.id::text || '-' || m.id::text)) % 100) < 8
ON CONFLICT (event_id, member_id, reaction_type) DO NOTHING;

-- COMMENTS (~60) from the six primary members on high-signal events
INSERT INTO public.feed_comments (id, event_id, member_id, comment_text, created_at)
SELECT
  md5('nx-comm-' || fe.id || '-' || m.id)::uuid,
  fe.id,
  m.id,
  (ARRAY[
    'Let''s go! 🔥',
    'Crushing it!',
    'Inspired by this',
    'Goals 💪',
    'Keep it up!',
    'Beast mode 🏆'
  ])[1 + (abs(hashtext('cm' || fe.id::text || m.id::text)) % 6)],
  fe.created_at + ((10 + (abs(hashtext('cmt' || fe.id::text || m.id::text)) % 110)) || ' minutes')::interval
FROM public.gym_feed_events fe
JOIN public.members m
  ON m.id IN (
    '00000000-0000-0000-0001-000000000001'::uuid,
    '00000000-0000-0000-0001-000000000002'::uuid,
    '00000000-0000-0000-0001-000000000003'::uuid,
    '00000000-0000-0000-0001-000000000005'::uuid,
    '00000000-0000-0000-0001-000000000006'::uuid,
    '00000000-0000-0000-0001-000000000008'::uuid
  )
WHERE fe.gym_id = '00000000-0000-0000-0000-000000000001'
  AND fe.event_type IN ('pr_weight', 'achievement_earned', 'streak_milestone', 'level_up', 'challenge_complete')
  AND fe.member_id IS DISTINCT FROM m.id
  AND (abs(hashtext('cpick' || fe.id::text || m.id::text)) % 100) < 7
ON CONFLICT (id) DO NOTHING;

-- Keep the denormalized comment_count accurate
UPDATE public.gym_feed_events fe
SET comment_count = c.cnt
FROM (
  SELECT event_id, COUNT(*) AS cnt
  FROM public.feed_comments
  GROUP BY event_id
) c
WHERE fe.id = c.event_id
  AND fe.gym_id = '00000000-0000-0000-0000-000000000001';
-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11 — WEEKLY CHECK-INS (48 historical + 2 pending drafts)
-- Adapted from DOC_04 to the real weekly_checkins schema:
--   trainer_message → final_message; status 'sent'/'replied'/'pending' →
--   sent_at/member_replied/trainer_approved flags; week_end is NOT NULL;
--   member_reply → reply_text; plus the required week-stats snapshot columns
--   (sessions_this_week etc.) which are computed from the REAL seeded
--   sessions. read_at comes from migration 014 (UI_009 unread ritual).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  G CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_i integer;
  v_w integer;
  v_mid uuid;
  v_m RECORD;
  v_ws date;
  v_we date;
  v_cnt integer;
  v_vol numeric;
  v_prs integer;
  v_prev_cnt integer;
  v_replied boolean;
  h integer;
BEGIN
  -- Historical check-ins: Alex's caseload (members 01-12), past 4 weeks
  FOR v_i IN 1..12 LOOP
    v_mid := ('00000000-0000-0000-0001-' || lpad(v_i::text, 12, '0'))::uuid;
    SELECT display_name, first_name, current_streak INTO v_m
      FROM public.members WHERE id = v_mid;
    CONTINUE WHEN NOT FOUND;

    FOR v_w IN 1..4 LOOP
      v_ws := (date_trunc('week', CURRENT_DATE::timestamp) - (v_w || ' weeks')::interval)::date;
      v_we := v_ws + 6;
      h := abs(hashtext('nx-checkin-' || v_i || '-' || v_w));

      SELECT COUNT(*), COALESCE(SUM(total_volume_lbs), 0),
             COUNT(*) FILTER (WHERE is_personal_best)
        INTO v_cnt, v_vol, v_prs
      FROM public.workout_sessions
      WHERE member_id = v_mid AND session_date BETWEEN v_ws AND v_we;

      SELECT COUNT(*) INTO v_prev_cnt
      FROM public.workout_sessions
      WHERE member_id = v_mid AND session_date BETWEEN v_ws - 7 AND v_ws - 1;

      v_replied := (h % 100) < 35;

      INSERT INTO public.weekly_checkins (
        id, member_id, gym_id, trainer_id, week_start, week_end,
        ai_draft, final_message, sent_by, trainer_approved, trainer_approved_at,
        sent_at, member_replied, reply_text, replied_at,
        sessions_this_week, sessions_last_week, total_volume_lbs, prs_this_week,
        current_streak, read_at
      ) VALUES (
        md5('nx-checkin-' || v_i || '-' || v_w)::uuid,
        v_mid, G, '00000000-0000-0000-0002-000000000001',
        v_ws, v_we,
        format('%s logged %s session(s) this week (%s lbs total volume, %s PR(s)). Streak: %s week(s). %s',
               v_m.display_name, v_cnt, v_vol::int, v_prs, v_m.current_streak,
               CASE WHEN v_cnt >= 3 THEN 'Consistency is excellent — keep the momentum.'
                    WHEN v_cnt >= 1 THEN 'A lighter week — a nudge on scheduling could help.'
                    ELSE 'No sessions logged — a personal re-engagement message is recommended.' END),
        format('%s — %s', COALESCE(v_m.first_name, v_m.display_name),
               CASE WHEN v_cnt >= 3 THEN 'great week! Your consistency is really showing. Keep it rolling.'
                    WHEN v_cnt >= 1 THEN 'solid effort this week. Let''s aim for one more session next week.'
                    ELSE 'we missed you this week — anything I can help with to get you back in?' END),
        'trainer_approved_ai', true,
        v_we::timestamptz - INTERVAL '30 hours',
        v_we::timestamptz - INTERVAL '26 hours',
        v_replied,
        CASE WHEN v_replied THEN
          (ARRAY['Thanks coach! Feeling good.',
                 'Appreciate it — next week will be better.',
                 'On it. Locking in my schedule now.',
                 'Feeling strong, ready for more.'])[1 + (h % 4)]
        ELSE NULL END,
        CASE WHEN v_replied THEN v_we::timestamptz - INTERVAL '20 hours' ELSE NULL END,
        v_cnt, v_prev_cnt, v_vol, v_prs, v_m.current_streak,
        v_we::timestamptz - INTERVAL '22 hours'
      )
      ON CONFLICT (member_id, week_start) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Carlos's last-week check-in gets the DOC_04 scripted reply
  UPDATE public.weekly_checkins SET
    member_replied = true,
    reply_text     = 'Feeling great! Sleep has been solid. Ready to push harder this week.',
    replied_at     = NOW() - INTERVAL '4 days'
  WHERE id = md5('nx-checkin-3-1')::uuid;

  -- Sofia's latest stays UNREAD (shows the UI_009 shimmer/pill ritual)
  UPDATE public.weekly_checkins SET
    read_at = NULL, member_replied = false, reply_text = NULL, replied_at = NULL
  WHERE id = md5('nx-checkin-2-1')::uuid;
END $$;

-- Two PENDING drafts awaiting trainer review (current week; DOC_04 texts)
INSERT INTO public.weekly_checkins (
  id, member_id, gym_id, trainer_id, week_start, week_end,
  ai_draft, trainer_approved, sent_at, member_replied,
  sessions_this_week, sessions_last_week, total_volume_lbs, prs_this_week, current_streak
) VALUES
  (md5('nx-checkin-pending-marcus')::uuid,
   '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001',
   date_trunc('week', CURRENT_DATE::timestamp)::date,
   date_trunc('week', CURRENT_DATE::timestamp)::date + 6,
   'Marcus had his biggest week yet — 6 sessions, 11-week streak, new PRs on lat pulldown and leg press. Score crossed 7,800 and he is close to the top of the leaderboard. Volume is high — worth checking in on sleep and nutrition.',
   false, NULL, false,
   6, 5, 48200, 2, 11),
  (md5('nx-checkin-pending-ana')::uuid,
   '00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001',
   date_trunc('week', CURRENT_DATE::timestamp)::date,
   date_trunc('week', CURRENT_DATE::timestamp)::date + 6,
   'Ana has not been in for 18 days. Prior to her absence she was training 2x per week for 8 weeks. No injury flags in her history — this is likely a motivation or schedule issue. A personal re-engagement message is recommended.',
   false, NULL, false,
   0, 0, 0, 0, 0)
ON CONFLICT (member_id, week_start) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12 — COACH NOTES + MESSAGES
-- Adapted from DOC_04: the spec's coach_notes(member_id → members, source
-- 'trainer'/'ai', acknowledged_at) maps to TWO real structures:
--   * coach_notes / coach_note_drafts / member_note_ack use PROFILE ids
--     (users.id) — only Carlos has a linked user, so the copilot rows target
--     him; source enum is workout|weekly|manual, AI drafts live in
--     coach_note_drafts (status 'pending').
--   * trainer_member_notes(member_id → members) carries the 30+ per-member
--     trainer notes for everyone else.
-- ─────────────────────────────────────────────────────────────────────────────

-- Copilot notes for Carlos (profile-based tables)
INSERT INTO public.coach_notes (
  id, gym_id, trainer_profile_id, member_profile_id, source, status,
  title, body, created_at, sent_at
) VALUES (
  md5('nx-cnote-carlos-1')::uuid,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0002-000000000007',
  'workout', 'sent',
  'Chest press form is dialed in',
  'Your chest press form has been excellent this week. Really dialing in the mind-muscle connection. Next session try slowing the eccentric to 3 seconds — it will unlock another level of growth.',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_note_ack (note_id, profile_id, acknowledged_at) VALUES
  (md5('nx-cnote-carlos-1')::uuid, '00000000-0000-0000-0002-000000000007', NOW() - INTERVAL '2 days')
ON CONFLICT (note_id, profile_id) DO NOTHING;

INSERT INTO public.coach_note_drafts (
  id, gym_id, trainer_profile_id, member_profile_id, period_start, period_end,
  draft_title, draft_body, confidence, status, created_at
) VALUES (
  md5('nx-cdraft-carlos-1')::uuid,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0002-000000000007',
  CURRENT_DATE - 7, CURRENT_DATE,
  'Balance pushing and pulling volume',
  'Based on the last 4 sessions, pushing strength is advancing faster than pulling. Consider adding an extra set of rows or lat pulldowns next week to keep the balance dimension of his DNA profile on track.',
  0.82, 'pending',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- 30 trainer notes across members 01-15 (member-id based table)
DO $$
DECLARE
  v_i integer;
  k integer;
  v_mid uuid;
  v_trainer uuid;
  v_types CONSTANT text[] := ARRAY['general','form','progress','program','general'];
  v_texts CONSTANT text[] := ARRAY[
    'Depth on leg press is improving every week — keep owning the tempo.',
    'Watch elbow flare on pressing movements; cue: elbows at 45 degrees.',
    'Volume trending up 3 weeks straight. Deload next week if sleep dips.',
    'Ready to progress to the next program block — nudge weight up 5%.',
    'Great energy this week. Encourage a rest day before the weekend.'
  ];
BEGIN
  FOR v_i IN 1..15 LOOP
    v_mid := ('00000000-0000-0000-0001-' || lpad(v_i::text, 12, '0'))::uuid;
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.members WHERE id = v_mid);
    v_trainer := CASE WHEN v_i <= 12
      THEN '00000000-0000-0000-0002-000000000001'::uuid
      ELSE '00000000-0000-0000-0002-000000000002'::uuid END;
    FOR k IN 1..2 LOOP
      INSERT INTO public.trainer_member_notes (
        id, trainer_id, member_id, gym_id, note_type, note_text,
        is_visible_to_member, created_at
      ) VALUES (
        md5('nx-tmn-' || v_i || '-' || k)::uuid,
        v_trainer, v_mid, '00000000-0000-0000-0000-000000000001',
        v_types[1 + ((v_i + k) % 5)],
        v_texts[1 + ((v_i * 2 + k) % 5)],
        (k = 1),
        NOW() - ((3 + v_i + k * 4) || ' days')::interval
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Message threads: Alex <-> Carlos (live demo thread) and Alex <-> Marcus
INSERT INTO public.trainer_member_messages
  (id, trainer_id, member_id, gym_id, sender_type, message_text, sent_at, read_at) VALUES
  (md5('nx-msg-carlos-1')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000001', 'trainer',
   'Carlos! Saw your chest press numbers from yesterday — that''s a new PR. How did it feel?',
   NOW() - INTERVAL '20 hours', NOW() - INTERVAL '19 hours'),
  (md5('nx-msg-carlos-2')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000001', 'member',
   'Felt strong! Last rep was a grind but form held up.',
   NOW() - INTERVAL '18 hours', NOW() - INTERVAL '17 hours'),
  (md5('nx-msg-carlos-3')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000001', 'trainer',
   'Perfect. Today is Upper A — try the slower eccentric we talked about on the first two sets.',
   NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),
  (md5('nx-msg-carlos-4')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000001', 'member',
   'Will do. Heading in after work 💪',
   NOW() - INTERVAL '2 hours', NULL),
  (md5('nx-msg-marcus-1')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0000-000000000001', 'trainer',
   'Monster week, Marcus. Check-in coming Sunday — keep an eye on recovery.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  (md5('nx-msg-marcus-2')::uuid, '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0000-000000000001', 'member',
   'Sleeping 8 hours, eating big. Ready for Level 10 🏆',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13 — BODY METRICS (12 weeks for Carlos + Marcus)
-- Adapted from DOC_04: real columns are body_fat_pct / chest_in / waist_in /
-- left_arm_in / right_arm_in (not *_percentage / *_inches / arms_inches),
-- and there is no created_at column (logged_at only).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_week integer;
BEGIN
  FOR v_week IN 0..11 LOOP
    -- Carlos: recomposition — weight down, chest up, waist down
    INSERT INTO public.body_metrics (
      id, member_id, gym_id, logged_at,
      weight_lbs, body_fat_pct, chest_in, waist_in, left_arm_in, right_arm_in
    ) VALUES (
      md5('nx-bm-carlos-' || v_week)::uuid,
      '00000000-0000-0000-0001-000000000003',
      '00000000-0000-0000-0000-000000000001',
      (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval) + INTERVAL '8 hours',
      ROUND((195.0 - (11 - v_week) * 0.4 + (abs(hashtext('bmw' || v_week)) % 20) / 10.0 - 1)::numeric, 1),
      ROUND((22.0 - (11 - v_week) * 0.25 + (abs(hashtext('bmf' || v_week)) % 5) / 10.0)::numeric, 1),
      ROUND((42.0 + (11 - v_week) * 0.10 + (abs(hashtext('bmc' || v_week)) % 3) / 10.0)::numeric, 1),
      ROUND((34.0 - (11 - v_week) * 0.10 + (abs(hashtext('bmwst' || v_week)) % 2) / 10.0)::numeric, 1),
      ROUND((15.5 + (11 - v_week) * 0.05 + (abs(hashtext('bmla' || v_week)) % 2) / 10.0)::numeric, 1),
      ROUND((15.5 + (11 - v_week) * 0.05 + (abs(hashtext('bmra' || v_week)) % 2) / 10.0)::numeric, 1)
    )
    ON CONFLICT (id) DO NOTHING;

    -- Marcus: lean bulk — weight up, body fat down
    INSERT INTO public.body_metrics (
      id, member_id, gym_id, logged_at, weight_lbs, body_fat_pct
    ) VALUES (
      md5('nx-bm-marcus-' || v_week)::uuid,
      '00000000-0000-0000-0001-000000000001',
      '00000000-0000-0000-0000-000000000001',
      (date_trunc('week', CURRENT_DATE::timestamp) - (v_week || ' weeks')::interval) + INTERVAL '9 hours',
      ROUND((215.0 + (11 - v_week) * 0.3 + (abs(hashtext('bmm' || v_week)) % 20) / 10.0 - 1)::numeric, 1),
      ROUND((18.0 - (11 - v_week) * 0.15 + (abs(hashtext('bmmf' || v_week)) % 4) / 10.0)::numeric, 1)
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 14 — READINESS / MUSCLE / DNA CACHES
-- Adapted from DOC_04 Section 14: compute_member_readiness(uuid) does NOT
-- exist as an RPC anywhere in the migrations. Real recompute is the
-- app-layer cron (/api/cron/readiness-recompute → member_readiness_cache).
-- The demo seeds today's cache rows directly instead, so readiness banners,
-- muscle maps and DNA pentagons render without waiting for the nightly job.
-- ─────────────────────────────────────────────────────────────────────────────

-- Today's readiness for every recently-active member
INSERT INTO public.member_readiness_cache (
  member_id, gym_id, cache_date, score, zone, result_json, inputs_json,
  dominant_signal, last_session_completed_at
)
SELECT
  m.id, '00000000-0000-0000-0000-000000000001', CURRENT_DATE,
  s.score,
  CASE WHEN s.score >= 85 THEN 'peak'
       WHEN s.score >= 65 THEN 'ready'
       WHEN s.score >= 45 THEN 'moderate'
       ELSE 'rest' END,
  jsonb_build_object(
    'score', s.score,
    'zone', CASE WHEN s.score >= 85 THEN 'peak'
                 WHEN s.score >= 65 THEN 'ready'
                 WHEN s.score >= 45 THEN 'moderate'
                 ELSE 'rest' END,
    'dominant_signal', 'recovery',
    'source', 'seed-bulk'
  ),
  jsonb_build_object('source', 'seed-bulk', 'sessions_considered', 14),
  'recovery',
  (SELECT MAX(ws.completed_at) FROM public.workout_sessions ws WHERE ws.member_id = m.id)
FROM public.members m
CROSS JOIN LATERAL (SELECT 45 + (abs(hashtext('rdy' || m.id::text)) % 50) AS score) s
WHERE m.gym_id = '00000000-0000-0000-0000-000000000001'
  AND m.is_active = true
  AND m.id::text LIKE '00000000-0000-0000-0001-%'
  AND m.last_session_date >= CURRENT_DATE - 10
ON CONFLICT (member_id, cache_date) DO NOTHING;

-- Carlos pinned to a strong "ready" score for the scan-flow demo
INSERT INTO public.member_readiness_cache (
  member_id, gym_id, cache_date, score, zone, result_json, inputs_json,
  dominant_signal, last_session_completed_at
) VALUES (
  '00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001',
  CURRENT_DATE, 82, 'ready',
  '{"score": 82, "zone": "ready", "dominant_signal": "recovery", "source": "seed-bulk"}',
  '{"source": "seed-bulk", "sessions_considered": 14}',
  'recovery',
  NOW() - INTERVAL '18 hours'
)
ON CONFLICT (member_id, cache_date) DO UPDATE
  SET score = 82, zone = 'ready', result_json = EXCLUDED.result_json;

-- Muscle map cache for Carlos + Marcus (yesterday was push day → chest worked)
INSERT INTO public.member_muscle_cache (member_id, gym_id, cache_date, muscle_states, recommendations) VALUES
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', CURRENT_DATE,
   '{"chest": {"status": "recovering", "recovery_pct": 55}, "triceps": {"status": "recovering", "recovery_pct": 60},
     "shoulders": {"status": "recovering", "recovery_pct": 70}, "back": {"status": "fresh", "recovery_pct": 95},
     "biceps": {"status": "fresh", "recovery_pct": 92}, "quads": {"status": "fresh", "recovery_pct": 88},
     "hamstrings": {"status": "fresh", "recovery_pct": 100}, "glutes": {"status": "fresh", "recovery_pct": 96},
     "calves": {"status": "fresh", "recovery_pct": 100}, "core": {"status": "fresh", "recovery_pct": 90}}',
   '[{"muscle": "hamstrings", "action": "train", "reason": "Fully recovered — Lower B is a great pick today"},
     {"muscle": "chest", "action": "rest", "reason": "Trained yesterday — still recovering"}]'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', CURRENT_DATE,
   '{"chest": {"status": "worked", "recovery_pct": 35}, "back": {"status": "recovering", "recovery_pct": 65},
     "quads": {"status": "recovering", "recovery_pct": 60}, "hamstrings": {"status": "fresh", "recovery_pct": 90},
     "shoulders": {"status": "recovering", "recovery_pct": 55}, "biceps": {"status": "fresh", "recovery_pct": 85},
     "triceps": {"status": "worked", "recovery_pct": 40}, "glutes": {"status": "fresh", "recovery_pct": 88},
     "calves": {"status": "fresh", "recovery_pct": 100}, "core": {"status": "fresh", "recovery_pct": 92}}',
   '[{"muscle": "hamstrings", "action": "train", "reason": "Fresh and ready for a pull from the floor"}]')
ON CONFLICT (member_id, cache_date) DO NOTHING;

-- DNA cache: primaries get scripted archetypes (real ai-assist archetype ids)
INSERT INTO public.member_dna_cache (
  member_id, gym_id, power_score, consistency_score, progression_score,
  balance_score, mindset_score, archetype_id, is_building,
  sessions_logged, distinct_machines, result_json
) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   88, 92, 74, 61, 85, 'warrior', false, 310, 14, '{"source": "seed-bulk"}'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001',
   62, 84, 58, 79, 72, 'iron_regular', false, 150, 12, '{"source": "seed-bulk"}'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001',
   58, 71, 86, 55, 68, 'climber', false, 60, 9, '{"source": "seed-bulk"}'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001',
   30, 25, 28, 40, 22, 'newcomer', true, 18, 5, '{"source": "seed-bulk"}'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001',
   15, 20, 18, 25, 30, 'newcomer', true, 3, 3, '{"source": "seed-bulk"}'),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001',
   45, 38, 52, 48, 55, 'sporadic_climber', false, 40, 8, '{"source": "seed-bulk"}')
ON CONFLICT (member_id) DO UPDATE
  SET power_score = EXCLUDED.power_score,
      consistency_score = EXCLUDED.consistency_score,
      progression_score = EXCLUDED.progression_score,
      balance_score = EXCLUDED.balance_score,
      mindset_score = EXCLUDED.mindset_score,
      archetype_id = EXCLUDED.archetype_id,
      is_building = EXCLUDED.is_building,
      computed_at = NOW();

-- DNA cache for the rest of the active roster (hash-derived, distinct shapes)
INSERT INTO public.member_dna_cache (
  member_id, gym_id, power_score, consistency_score, progression_score,
  balance_score, mindset_score, archetype_id, is_building,
  sessions_logged, distinct_machines, result_json
)
SELECT
  m.id, '00000000-0000-0000-0000-000000000001',
  30 + (abs(hashtext('dnap' || m.id::text)) % 60),
  30 + (abs(hashtext('dnac' || m.id::text)) % 60),
  30 + (abs(hashtext('dnag' || m.id::text)) % 60),
  30 + (abs(hashtext('dnab' || m.id::text)) % 60),
  30 + (abs(hashtext('dnam' || m.id::text)) % 60),
  (ARRAY['iron_regular','climber','specialist','foundation_builder','explorer','streak_hunter','rising_athlete','dedicated_grinder'])
    [1 + (abs(hashtext('dnaa' || m.id::text)) % 8)],
  false,
  20 + (abs(hashtext('dnas' || m.id::text)) % 120),
  5 + (abs(hashtext('dnad' || m.id::text)) % 10),
  '{"source": "seed-bulk"}'
FROM public.members m
WHERE m.gym_id = '00000000-0000-0000-0000-000000000001'
  AND m.is_active = true
  AND m.id::text LIKE '00000000-0000-0000-0001-%'
  AND m.id > '00000000-0000-0000-0001-000000000006'::uuid
  AND m.last_session_date >= CURRENT_DATE - 14
ON CONFLICT (member_id) DO NOTHING;

-- 8 weeks of DNA snapshots for Carlos — progression climbing (his story)
DO $$
DECLARE
  v_w integer;
BEGIN
  FOR v_w IN 0..7 LOOP
    INSERT INTO public.member_dna_snapshots (
      id, member_id, gym_id, snapshot_date,
      power_score, consistency_score, progression_score, balance_score,
      mindset_score, archetype_id
    ) VALUES (
      md5('nx-dnasnap-carlos-' || v_w)::uuid,
      '00000000-0000-0000-0001-000000000003',
      '00000000-0000-0000-0000-000000000001',
      (date_trunc('week', CURRENT_DATE::timestamp) - (v_w || ' weeks')::interval)::date,
      58 - v_w * 2, 71 - v_w, 86 - v_w * 4, 55 - v_w, 68 - v_w * 2,
      CASE WHEN v_w >= 6 THEN 'foundation_builder' ELSE 'climber' END
    )
    ON CONFLICT (member_id, snapshot_date) DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- WRAP UP — re-enable triggers, verify
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  SET session_replication_role = 'origin';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- NOTE (DOC_04 Section 14 adaptation): the spec's final
--   SELECT compute_member_readiness(id) FROM members ...
-- is omitted — that RPC does not exist in any migration. Readiness, muscle
-- map and DNA caches were seeded directly above; the nightly app-layer crons
-- (/api/cron/readiness-recompute, /api/cron/dna-recompute) refresh them.

-- Verification (expected: members=50, machines=20, sessions=600+,
-- feed_events=200+, challenges=6, checkins=40+, achievements=180+, reactions=300+)
SELECT
  (SELECT COUNT(*) FROM public.members            WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND id::text LIKE '00000000-0000-0000-0001-%') AS members,
  (SELECT COUNT(*) FROM public.machines           WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS machines,
  (SELECT COUNT(*) FROM public.workout_sessions   WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS sessions,
  (SELECT COUNT(*) FROM public.workout_sessions   WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND is_personal_best) AS pr_sessions,
  (SELECT COUNT(*) FROM public.gym_feed_events    WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS feed_events,
  (SELECT COUNT(*) FROM public.feed_reactions fr JOIN public.gym_feed_events fe ON fe.id = fr.event_id
    WHERE fe.gym_id = '00000000-0000-0000-0000-000000000001') AS reactions,
  (SELECT COUNT(*) FROM public.gym_challenges     WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS challenges,
  (SELECT COUNT(*) FROM public.weekly_checkins    WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS checkins,
  (SELECT COUNT(*) FROM public.member_achievements WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS achievements,
  (SELECT COUNT(*) FROM public.body_metrics       WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS body_metrics;
