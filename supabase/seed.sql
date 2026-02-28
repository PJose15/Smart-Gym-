-- ============================================================
-- SmartGym Seed Data
-- ============================================================
-- NOTE: In production, profiles are created via Supabase Auth triggers.
-- For seeding, we insert directly. Replace UUIDs with real auth.users IDs
-- when connecting to a real Supabase project.
-- ============================================================

-- Sample UUIDs (replace with real auth user IDs in production)
-- Owner:   11111111-1111-1111-1111-111111111111
-- Trainer: 22222222-2222-2222-2222-222222222222
-- Member:  33333333-3333-3333-3333-333333333333

-- ─── GYM ────────────────────────────────────────────────────

INSERT INTO gyms (id, name, slug, address) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Iron Paradise', 'iron-paradise', '123 Fitness Ave, Los Angeles, CA');

-- ─── PROFILES ───────────────────────────────────────────────

INSERT INTO profiles (id, email, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@ironparadise.com', 'Alex Owner'),
  ('22222222-2222-2222-2222-222222222222', 'trainer@ironparadise.com', 'Jordan Trainer'),
  ('33333333-3333-3333-3333-333333333333', 'member@ironparadise.com', 'Sam Member');

-- ─── GYM MEMBERSHIPS ───────────────────────────────────────

INSERT INTO gym_members (gym_id, profile_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'trainer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member');

-- ─── MACHINES ───────────────────────────────────────────────

INSERT INTO machines (gym_id, name, qr_slug, target_muscles, setup_steps, safety_cues, common_mistakes, cue_version, cue_source, movement_pattern, equipment_type, difficulty, primary_muscles, secondary_muscles) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Chest Press Machine',
    'iron-paradise-chest-press',
    ARRAY['chest', 'triceps', 'front deltoids'],
    ARRAY[
      'Adjust the seat height so the handles are at chest level',
      'Set the desired weight on the weight stack',
      'Sit with your back flat against the pad',
      'Grip the handles with a firm, neutral grip'
    ],
    ARRAY[
      'Do not lock your elbows at full extension',
      'Keep your back pressed against the pad throughout the movement',
      'Start with a lighter weight to warm up',
      'Stop immediately if you feel sharp pain in your shoulders'
    ],
    ARRAY[
      'Flaring elbows too wide — keep elbows at ~45 degrees to protect shoulders.',
      'Arching lower back excessively — maintain contact with the pad.',
      'Using momentum instead of controlled movement.',
      'Locking out joints at the top — keep a slight bend.',
      'Gripping the handles too tightly — relax your grip.'
    ],
    1,
    'manual',
    'push',
    'machine',
    'beginner',
    ARRAY['chest', 'triceps'],
    ARRAY['front deltoids']
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Lat Pulldown',
    'iron-paradise-lat-pulldown',
    ARRAY['lats', 'biceps', 'rear deltoids', 'rhomboids'],
    ARRAY[
      'Adjust the thigh pad to secure your legs',
      'Select the desired weight',
      'Stand and grip the bar slightly wider than shoulder width',
      'Sit down and secure your thighs under the pad'
    ],
    ARRAY[
      'Never pull the bar behind your neck — always pull to your upper chest',
      'Avoid using momentum or swinging your body',
      'Control the weight on the way up — do not let it slam',
      'Keep your core engaged throughout the movement'
    ],
    ARRAY[
      'Using momentum or swinging the body — initiate the pull with your back.',
      'Shrugging shoulders up — depress shoulder blades before pulling.',
      'Pulling with biceps only — focus on squeezing the back.',
      'Not achieving full range of motion.',
      'Leaning too far back on the pulldown — maintain a slight lean only.'
    ],
    1,
    'manual',
    'pull',
    'cable',
    'beginner',
    ARRAY['lats', 'biceps'],
    ARRAY['rear deltoids', 'rhomboids']
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Leg Press',
    'iron-paradise-leg-press',
    ARRAY['quadriceps', 'glutes', 'hamstrings'],
    ARRAY[
      'Adjust the seat to a comfortable position',
      'Place your feet shoulder-width apart on the platform',
      'Set the desired weight',
      'Release the safety catch'
    ],
    ARRAY[
      'Do not lock your knees at full extension',
      'Keep your lower back pressed against the pad',
      'Start with a lighter weight to warm up',
      'Re-engage the safety catch when finished'
    ],
    ARRAY[
      'Letting knees cave inward — push knees outward in line with toes.',
      'Bouncing at the bottom — control the eccentric.',
      'Locking out knees at the top.',
      'Lifting hips off the pad.',
      'Using too narrow a foot position.'
    ],
    1,
    'manual',
    'squat',
    'machine',
    'beginner',
    ARRAY['quadriceps', 'glutes'],
    ARRAY['hamstrings', 'calves']
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Cable Chest Fly',
    'iron-paradise-cable-chest-fly',
    ARRAY['chest', 'front deltoids'],
    ARRAY[
      'Set cable pulleys to shoulder height',
      'Select the desired weight on each side',
      'Stand in the center and grip both handles',
      'Step forward slightly for a stable stance'
    ],
    ARRAY[
      'Control the movement — avoid letting cables snap back',
      'Keep a slight bend in your elbows throughout',
      'Do not use excessive weight',
      'Stop if you feel shoulder impingement'
    ],
    ARRAY[
      'Using too much weight and losing form.',
      'Straightening arms fully — maintain the elbow bend.',
      'Not controlling the eccentric portion.',
      'Leaning too far forward.',
      'Rushing through reps.'
    ],
    1,
    'manual',
    'push',
    'cable',
    'intermediate',
    ARRAY['chest'],
    ARRAY['front deltoids', 'biceps']
  );

-- ─── USER TRAINING PROFILES ──────────────────────────────

INSERT INTO user_training_profiles (gym_id, profile_id, goal, experience, units, limitations) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'hypertrophy', 'intermediate', 'lbs', ARRAY['knee_sensitive']);

-- ─── TRAINER ASSIGNMENTS (Phase 2.5.3) ───────────────────

INSERT INTO trainer_assignments (gym_id, trainer_profile_id, member_profile_id, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'active');

-- ─── TRAINER STYLE SETTINGS (Phase 2.5.4) ─────────────────

INSERT INTO trainer_style_settings (gym_id, trainer_profile_id, tone, verbosity) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'supportive', 'standard');

-- ─── FEATURE FLAGS (Phase 2.5) ─────────────────────────────

INSERT INTO feature_flags (gym_id, profile_id, key, enabled) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_assist_enabled', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'training_profile_enabled', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'why_this_today_enabled', true);
