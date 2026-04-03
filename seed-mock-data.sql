-- ============================================================
-- NEXERA MOCK DATA SEED
-- Paste this entire script into Supabase SQL Editor and run it.
-- Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================================

-- The admin user was already created via auth signup:
-- Email: admin@nexera-demo.com / Password: nexera123
-- User ID: 961fd01b-e863-4812-9075-cc27fb94ec32

DO $$
DECLARE
  v_owner_id uuid := '961fd01b-e863-4812-9075-cc27fb94ec32';
  v_trainer_id uuid;
  v_gym_id uuid;
  v_machine_ids uuid[];
  v_member_ids uuid[];
  v_mid uuid;
BEGIN

-- 1. Public users record for owner
INSERT INTO users (id, email, display_name, first_name, platform_role)
VALUES (v_owner_id, 'admin@nexera-demo.com', 'Pedro Admin', 'Pedro', 'gym_owner')
ON CONFLICT (id) DO UPDATE SET platform_role = 'gym_owner';

-- 2. Create trainer auth user (if not exists)
-- We'll create a public user record directly; trainer can log in via staff login
v_trainer_id := gen_random_uuid();
INSERT INTO users (id, email, display_name, first_name, platform_role)
VALUES (v_trainer_id, 'carlos@nexera-demo.com', 'Carlos Rivera', 'Carlos', 'trainer')
ON CONFLICT DO NOTHING;

-- 3. Create gym
INSERT INTO gyms (name, slug, owner_id, gym_type, description, member_count_estimate, address, city, country, phone, subscription_tier, subscription_status, is_active)
VALUES (
  'Nexera Fitness Lab',
  'nexera-fitness-lab',
  v_owner_id,
  'independent',
  'AI-powered strength & conditioning facility',
  120,
  '123 Fitness Ave, San Juan',
  'San Juan',
  'PR',
  '+1-787-555-0100',
  'pro',
  'active',
  true
)
ON CONFLICT (slug) DO NOTHING
RETURNING id INTO v_gym_id;

-- If gym already existed, fetch its id
IF v_gym_id IS NULL THEN
  SELECT id INTO v_gym_id FROM gyms WHERE slug = 'nexera-fitness-lab';
END IF;

-- 4. Gym memberships
INSERT INTO gym_memberships (user_id, gym_id, role, status)
VALUES (v_owner_id, v_gym_id, 'owner', 'active')
ON CONFLICT (user_id, gym_id) DO NOTHING;

INSERT INTO gym_memberships (user_id, gym_id, role, status)
VALUES (v_trainer_id, v_gym_id, 'trainer', 'active')
ON CONFLICT (user_id, gym_id) DO NOTHING;

-- 5. Machines (10 pieces of equipment)
INSERT INTO machines (gym_id, name, brand, model, category, muscle_groups, qr_slug, location_in_gym, is_active) VALUES
  (v_gym_id, 'Bench Press Station', 'Rogue', 'Monster Bench', 'strength', ARRAY['chest','triceps','shoulders'], 'bench-press-1', 'Zone A - Free Weights', true),
  (v_gym_id, 'Squat Rack', 'Rogue', 'Monster Squat Stand', 'strength', ARRAY['quads','glutes','hamstrings'], 'squat-rack-1', 'Zone A - Free Weights', true),
  (v_gym_id, 'Deadlift Platform', 'Rogue', 'Oly Platform', 'strength', ARRAY['back','glutes','hamstrings'], 'deadlift-1', 'Zone A - Free Weights', true),
  (v_gym_id, 'Lat Pulldown', 'Life Fitness', 'Pro2 SE', 'cable', ARRAY['back','biceps'], 'lat-pulldown-1', 'Zone B - Cables', true),
  (v_gym_id, 'Cable Crossover', 'Life Fitness', 'Dual Adjustable Pulley', 'cable', ARRAY['chest','shoulders'], 'cable-cross-1', 'Zone B - Cables', true),
  (v_gym_id, 'Leg Press', 'Hammer Strength', 'Linear Leg Press', 'strength', ARRAY['quads','glutes'], 'leg-press-1', 'Zone C - Machines', true),
  (v_gym_id, 'Shoulder Press Machine', 'Hammer Strength', 'Plate-Loaded', 'strength', ARRAY['shoulders','triceps'], 'shoulder-press-1', 'Zone C - Machines', true),
  (v_gym_id, 'Treadmill', 'Technogym', 'Run Personal', 'cardio', ARRAY['quads','calves'], 'treadmill-1', 'Zone D - Cardio', true),
  (v_gym_id, 'Rowing Machine', 'Concept2', 'Model D', 'cardio', ARRAY['back','legs','core'], 'rower-1', 'Zone D - Cardio', true),
  (v_gym_id, 'Smith Machine', 'Life Fitness', 'Signature Series', 'strength', ARRAY['chest','shoulders','quads'], 'smith-1', 'Zone A - Free Weights', true)
ON CONFLICT (qr_slug) DO NOTHING;

-- Collect machine IDs
SELECT array_agg(id) INTO v_machine_ids FROM machines WHERE gym_id = v_gym_id;

-- 6. Members (8 gym members)
INSERT INTO members (gym_id, display_name, first_name, email, phone, primary_goal, experience_level, assigned_trainer_id, onboarding_status, is_active, status, smartgym_score, current_streak) VALUES
  (v_gym_id, 'Maria Santos', 'Maria', 'maria@example.com', '+17875550101', 'muscle-gain', 'intermediate', v_trainer_id, 'active', true, 'active', 78, 12),
  (v_gym_id, 'Jose Ortiz', 'Jose', 'jose@example.com', '+17875550102', 'strength', 'advanced', v_trainer_id, 'active', true, 'active', 92, 24),
  (v_gym_id, 'Ana Rodriguez', 'Ana', 'ana@example.com', '+17875550103', 'weight-loss', 'beginner', v_trainer_id, 'active', true, 'active', 45, 5),
  (v_gym_id, 'Luis Garcia', 'Luis', 'luis@example.com', '+17875550104', 'endurance', 'intermediate', v_trainer_id, 'active', true, 'active', 67, 8),
  (v_gym_id, 'Carmen Diaz', 'Carmen', 'carmen@example.com', '+17875550105', 'general-fitness', 'beginner', v_trainer_id, 'active', true, 'active', 38, 3),
  (v_gym_id, 'Miguel Torres', 'Miguel', 'miguel@example.com', '+17875550106', 'muscle-gain', 'advanced', v_trainer_id, 'active', true, 'active', 88, 30),
  (v_gym_id, 'Sofia Ramos', 'Sofia', 'sofia@example.com', '+17875550107', 'strength', 'intermediate', v_trainer_id, 'active', true, 'active', 71, 15),
  (v_gym_id, 'Diego Mendez', 'Diego', 'diego@example.com', '+17875550108', 'muscle-gain', 'intermediate', v_trainer_id, 'active', true, 'active', 62, 9)
ON CONFLICT (gym_id, phone) DO NOTHING;

-- Collect member IDs
SELECT array_agg(id) INTO v_member_ids FROM members WHERE gym_id = v_gym_id;

-- 7. Workout sessions (past 7 days of activity)
IF array_length(v_member_ids, 1) > 0 AND array_length(v_machine_ids, 1) > 0 THEN
  FOR i IN 0..6 LOOP
    FOR j IN 1..3 LOOP
      v_mid := v_member_ids[1 + (i * 3 + j) % array_length(v_member_ids, 1)];
      INSERT INTO workout_sessions (
        gym_id, machine_id, member_id, session_date, workout_mode,
        sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps,
        is_personal_best, personal_best_type
      ) VALUES (
        v_gym_id,
        v_machine_ids[1 + (i + j) % array_length(v_machine_ids, 1)],
        v_mid,
        (CURRENT_DATE - i)::date,
        CASE WHEN random() > 0.5 THEN 'ai_program' ELSE 'free' END,
        jsonb_build_array(
          jsonb_build_object('weight', 95 + (i * 10 + j * 15) % 150, 'reps', 6 + j % 6, 'rpe', 7),
          jsonb_build_object('weight', 95 + (i * 10 + j * 15) % 150, 'reps', 5 + j % 5, 'rpe', 8),
          jsonb_build_object('weight', 85 + (i * 10 + j * 15) % 130, 'reps', 8 + j % 4, 'rpe', 8),
          jsonb_build_object('weight', 85 + (i * 10 + j * 15) % 130, 'reps', 7 + j % 3, 'rpe', 9)
        ),
        4,
        (95 + (i * 10 + j * 15) % 150) * (6 + j % 6) * 4,
        95 + (i * 10 + j * 15) % 150,
        8 + j % 4,
        CASE WHEN j = 1 THEN true ELSE false END,
        CASE WHEN j = 1 THEN 'weight' ELSE NULL END
      );
    END LOOP;
  END LOOP;
END IF;

-- 8. AI Programs (3 active programs)
IF array_length(v_member_ids, 1) >= 3 THEN
  INSERT INTO ai_programs (member_id, gym_id, title, description, goal, experience_level, duration_weeks, sessions_per_week, focus, generated_by, is_active, week_number, sessions_completed, sessions_total, on_track, program_data) VALUES
    (v_member_ids[1], v_gym_id, 'Hypertrophy Push/Pull/Legs', '12-week muscle building program focused on progressive overload', 'muscle-gain', 'intermediate', 12, 4, 'hypertrophy', 'ai', true, 3, 10, 48, true, '{"weeks":[]}'::jsonb),
    (v_member_ids[2], v_gym_id, '5/3/1 Strength Foundation', 'Wendler 5/3/1 progression for compound lifts', 'strength', 'advanced', 16, 4, 'strength', 'ai', true, 6, 22, 64, true, '{"weeks":[]}'::jsonb),
    (v_member_ids[3], v_gym_id, 'Beginner Full Body', 'Introduction to resistance training with full-body sessions', 'general-fitness', 'beginner', 8, 3, 'full-body', 'trainer', true, 2, 4, 24, true, '{"weeks":[]}'::jsonb)
  ON CONFLICT DO NOTHING;
END IF;

RAISE NOTICE 'Seed complete! Gym: %, Members: %, Machines: %', v_gym_id, array_length(v_member_ids, 1), array_length(v_machine_ids, 1);

END $$;
