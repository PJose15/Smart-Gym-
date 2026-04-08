DO $$
DECLARE
  v_uid uuid;
  v_gid uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid(); v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid(); v_m4 uuid := gen_random_uuid();
  v_m5 uuid := gen_random_uuid(); v_m6 uuid := gen_random_uuid();
  v_mem1 uuid := gen_random_uuid(); v_mem2 uuid := gen_random_uuid();
  v_mem3 uuid := gen_random_uuid(); v_mem4 uuid := gen_random_uuid();
  v_omem uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email='demo@nexera.com' LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Demo user not found'; END IF;

  INSERT INTO users (id, email, display_name) VALUES (v_uid, 'demo@nexera.com', 'Pedro Demo') ON CONFLICT (id) DO NOTHING;

  INSERT INTO gyms (id, name, slug, address, city, country, owner_id) VALUES
  (v_gid, 'Nexera Fitness Hub', 'nexera-fitness-hub', '123 Main St', 'Miami', 'US', v_uid) ON CONFLICT DO NOTHING;

  INSERT INTO gym_memberships (id, user_id, gym_id, role, status) VALUES
  (gen_random_uuid(), v_uid, v_gid, 'owner', 'active') ON CONFLICT DO NOTHING;

  INSERT INTO members (id, user_id, gym_id, display_name, status, created_at) VALUES
  (v_omem, v_uid, v_gid, 'Pedro Demo', 'active', now()),
  (v_mem1, NULL, v_gid, 'Maria Santos', 'active', now()-interval '30 days'),
  (v_mem2, NULL, v_gid, 'Carlos Rivera', 'active', now()-interval '25 days'),
  (v_mem3, NULL, v_gid, 'Ana Rodriguez', 'active', now()-interval '20 days'),
  (v_mem4, NULL, v_gid, 'James Chen', 'active', now()-interval '15 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO machines (id, gym_id, name, qr_slug, category, muscle_groups, instructions) VALUES
  (v_m1, v_gid, 'Bench Press Station', 'bench-press', 'strength', ARRAY['chest','triceps','shoulders'], ARRAY['Set bar at chest height','Add plates evenly','Use spotter for heavy sets']),
  (v_m2, v_gid, 'Lat Pulldown', 'lat-pulldown', 'cable', ARRAY['back','biceps'], ARRAY['Adjust thigh pad','Select weight','Pull to upper chest']),
  (v_m3, v_gid, 'Leg Press', 'leg-press', 'strength', ARRAY['quadriceps','glutes','hamstrings'], ARRAY['Adjust seat','Place feet on platform','Do not lock knees']),
  (v_m4, v_gid, 'Cable Row', 'cable-row', 'cable', ARRAY['back','biceps'], ARRAY['Attach handle','Sit and brace feet','Squeeze shoulder blades']),
  (v_m5, v_gid, 'Shoulder Press', 'shoulder-press', 'strength', ARRAY['shoulders','triceps'], ARRAY['Adjust seat height','Press smoothly','Do not lock elbows']),
  (v_m6, v_gid, 'Smith Machine Squat', 'smith-squat', 'strength', ARRAY['quadriceps','glutes','core'], ARRAY['Set bar at shoulder height','Unlock bar','Descend to parallel'])
  ON CONFLICT DO NOTHING;

  INSERT INTO workout_sessions (id, gym_id, member_id, machine_id, session_date, sets_count, total_volume_lbs, best_weight_lbs, best_reps, is_personal_best, completed_at) VALUES
  (gen_random_uuid(), v_gid, v_omem, v_m1, CURRENT_DATE, 4, 2400, 185, 8, true, now()-interval '1 hour'),
  (gen_random_uuid(), v_gid, v_omem, v_m4, CURRENT_DATE, 4, 1800, 120, 10, false, now()-interval '45 min'),
  (gen_random_uuid(), v_gid, v_omem, v_m3, CURRENT_DATE-1, 3, 3200, 315, 8, true, now()-interval '1 day'),
  (gen_random_uuid(), v_gid, v_mem1, v_m2, CURRENT_DATE, 4, 1600, 100, 12, false, now()-interval '3 hours'),
  (gen_random_uuid(), v_gid, v_mem1, v_m5, CURRENT_DATE, 3, 900, 80, 10, false, now()-interval '2 hours'),
  (gen_random_uuid(), v_gid, v_mem2, v_m6, CURRENT_DATE, 4, 2800, 225, 6, true, now()-interval '4 hours'),
  (gen_random_uuid(), v_gid, v_mem2, v_m1, CURRENT_DATE-1, 4, 2000, 155, 10, false, now()-interval '1 day 2 hours'),
  (gen_random_uuid(), v_gid, v_mem3, v_m3, CURRENT_DATE, 3, 1500, 200, 10, false, now()-interval '5 hours'),
  (gen_random_uuid(), v_gid, v_mem4, v_m2, CURRENT_DATE-1, 5, 2000, 90, 15, false, now()-interval '1 day 4 hours'),
  (gen_random_uuid(), v_gid, v_mem1, v_m1, CURRENT_DATE, 2, 800, 95, 8, false, NULL)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'SEED DONE — Gym: %, Machines: 6, Members: 5, Sessions: 10', v_gid;
END;
$$;
