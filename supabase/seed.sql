-- ============================================================
-- NEXERA (SmartGym) — Seed Data
-- Source of truth: DOC_20_DATABASE_MASTER.md Section 19
-- ============================================================

-- ============================================================
-- FEATURE FLAGS — initial platform configuration
-- ============================================================
INSERT INTO feature_flags (flag_key, is_enabled, description)
VALUES
  ('ai_chat_enabled',          true,  'AI coaching chat for Pro tier members'),
  ('social_feed_enabled',      true,  'Gym social feed for Growth and Pro gyms'),
  ('ai_program_generation',    true,  'Auto-generate programs after 3 sessions'),
  ('global_leaderboard',       false, 'Cross-gym leaderboard (Phase 5 — disabled)'),
  ('push_notifications_enabled', true, 'Platform-wide web push notification sending'),
  ('uptimizeai_agents_enabled', true,  'All UptimizeAI agent automation workflows'),
  ('new_gym_registrations',    true,  'Allow new gyms to self-register');

-- ============================================================
-- ACHIEVEMENT DEFINITIONS — complete achievement catalog
-- ============================================================

-- MILESTONE CATEGORY
INSERT INTO achievement_definitions
  (code, title, description, category, points, required_value, required_unit, sort_order)
VALUES
  ('first-scan',       'First Step',        'Logged your first ever workout',                 'milestone', 50,   1,    'sessions', 10),
  ('sessions-10',      'Getting Started',   'Logged 10 workout sessions',                     'milestone', 100,  10,   'sessions', 20),
  ('sessions-50',      'Halfway There',     'Logged 50 workout sessions',                     'milestone', 250,  50,   'sessions', 30),
  ('sessions-100',     'Century Club',      '100 sessions logged',                            'milestone', 500,  100,  'sessions', 40),
  ('sessions-200',     'Unstoppable',       '200 sessions. You do not quit.',                 'milestone', 750,  200,  'sessions', 50),
  ('sessions-500',     'Legend Status',     '500 sessions. This is who you are now.',         'milestone', 1500, 500,  'sessions', 60),
  ('program-complete', 'Program Graduate',  'Completed your first AI training program',       'milestone', 300,  1,    'programs', 70),
  ('programs-3',       'Three and Done',    'Completed 3 full training programs',             'milestone', 600,  3,    'programs', 80),
  ('level-5',          'Dedicated',         'Reached Level 5 — Dedicated',                   'milestone', 200,  5,    'level',    90),
  ('level-10',         'Legend',            'Reached Level 10 — the highest rank',            'milestone', 1000, 10,   'level',    100);

-- PERFORMANCE CATEGORY
INSERT INTO achievement_definitions
  (code, title, description, category, points, required_value, required_unit, sort_order)
VALUES
  ('first-pr',         'First PR',          'Hit your first personal record',                 'performance', 100,  1,    'prs',  110),
  ('prs-5',            'Record Breaker',    '5 personal records set',                         'performance', 200,  5,    'prs',  120),
  ('prs-10',           'On a Roll',         '10 personal records set',                        'performance', 350,  10,   'prs',  130),
  ('prs-25',           'PR Machine',        '25 personal records. Relentless.',               'performance', 600,  25,   'prs',  140),
  ('prs-50',           'Unstoppable Force', '50 personal records. You keep getting stronger.','performance', 1000, 50,   'prs',  150),
  ('volume-10k',       'Ten Thousand',      'Lifted 10,000 lbs total volume',                 'performance', 150,  10000,'lbs',  160),
  ('volume-100k',      'Hundred Thousand',  '100,000 lbs total volume lifted',                'performance', 400,  100000,'lbs', 170),
  ('volume-1m',        'One Million',       '1,000,000 lbs total. A million pound club.',     'performance', 1000, 1000000,'lbs',180);

-- CONSISTENCY CATEGORY
INSERT INTO achievement_definitions
  (code, title, description, category, points, required_value, required_unit, sort_order)
VALUES
  ('streak-3',         'Three in a Row',    'Trained 3 days in a row',                        'consistency', 50,   3,   'days', 190),
  ('streak-7',         'Week Warrior',      '7-day training streak',                          'consistency', 150,  7,   'days', 200),
  ('streak-14',        'Two Week Run',      'Two weeks straight without missing a day',       'consistency', 250,  14,  'days', 210),
  ('streak-30',        'Monthly Grinder',   '30-day streak. One full month.',                 'consistency', 500,  30,  'days', 220),
  ('streak-60',        'Iron Habit',        '60 days straight. This is a lifestyle now.',     'consistency', 750,  60,  'days', 230),
  ('streak-90',        'Quarterly Iron',    '90-day streak. Three months of consistency.',    'consistency', 1000, 90,  'days', 240),
  ('streak-180',       'Half Year',         'Six months without missing a day.',              'consistency', 1500, 180, 'days', 250),
  ('streak-365',       'Full Year',         '365-day streak. A full year of training.',       'consistency', 3000, 365, 'days', 260);

-- EXPLORER CATEGORY
INSERT INTO achievement_definitions
  (code, title, description, category, points, required_value, required_unit, sort_order)
VALUES
  ('machines-3',       'Machine Curious',   'Used 3 different machines',                      'explorer', 75,   3,  'machines', 270),
  ('machines-10',      'Gym Explorer',      'Used 10 different machines',                     'explorer', 200,  10, 'machines', 280),
  ('machines-all',     'Full Gym',          'Used every machine in your gym',                 'explorer', 500,  0,  'machines', 290),
  ('first-cardio',     'Cardio Curious',    'Logged your first cardio session',               'explorer', 50,   1,  'sessions', 300),
  ('first-program',    'Program Starter',   'Started your first AI training program',         'explorer', 100,  1,  'programs', 310);

-- COMMUNITY CATEGORY
INSERT INTO achievement_definitions
  (code, title, description, category, points, required_value, required_unit, sort_order)
VALUES
  ('challenge-join',   'Challenge Accepted', 'Joined your first gym challenge',               'community', 75,   1, 'challenges', 320),
  ('challenge-win',    'Champion',           'Won a gym challenge',                           'community', 500,  1, 'wins',       330),
  ('challenge-podium', 'Top of the Gym',     'Finished in the top 3 of a gym challenge',      'community', 200,  1, 'podiums',    340),
  ('spotlight',        'Spotlight Athlete',  'Featured as a gym member spotlight',            'community', 250,  1, 'spotlights', 350);

-- ============================================================
-- TIP LIBRARY — seed coaching tips by category
-- ============================================================
INSERT INTO tip_library
  (machine_category, experience_level, tip_text)
VALUES
  -- CHEST
  ('chest', null,           'Control the movement in both directions. The eccentric phase builds as much strength as the push.'),
  ('chest', 'beginner',     'Start lighter than you think you need to. Perfect form first, weight second — always.'),
  ('chest', 'intermediate', 'If you hit the upper rep target two sessions in a row, it is time to add weight.'),
  ('chest', 'advanced',     'Mind-muscle connection matters more than load. Feel the chest doing the work on every rep.'),

  -- BACK
  ('back', null,            'Squeeze your shoulder blades together at the peak of each rep. That is where the muscle fires.'),
  ('back', 'beginner',      'Think about pulling your elbows toward your hips, not pulling with your hands.'),
  ('back', 'intermediate',  'Full stretch at the bottom is as important as the contraction at the top.'),
  ('back', 'advanced',      'Vary your grip width between sessions to target different parts of the back.'),

  -- LEGS
  ('legs', null,            'Drive through your heels, not your toes. You will feel the difference in your glutes immediately.'),
  ('legs', 'beginner',      'Do not rush the return. A slow descent builds more strength than a fast one.'),
  ('legs', 'intermediate',  'Full depth is more important than the weight on the machine. Earn the depth first.'),
  ('legs', 'advanced',      'If your lower back is taking over, the weight is too heavy or depth is too shallow.'),

  -- SHOULDERS
  ('shoulders', null,       'Keep your core tight throughout. A stable base makes every shoulder movement more effective.'),
  ('shoulders', 'beginner', 'Shoulders fatigue quickly. Shorter rest periods here will limit your strength.'),
  ('shoulders', 'intermediate', 'Do not let momentum do the work. Slow it down and feel the deltoid engage.'),

  -- ARMS
  ('arms', null,            'Full range of motion on every rep. Partial reps limit your long-term results.'),
  ('arms', 'beginner',      'Your grip should be firm but not white-knuckle. Tension in the forearm bleeds off the target muscle.'),
  ('arms', 'advanced',      'Supinate the wrist at the top of a curl for full bicep contraction.'),

  -- CORE
  ('core', null,            'Exhale on the effort. Holding your breath reduces your stability and power output.'),
  ('core', 'beginner',      'Feel the contraction, not just the movement. A slow, deliberate crunch beats 30 fast ones.'),

  -- CARDIO
  ('cardio', null,          'Consistent pace beats occasional intensity for building the habit. Show up first, push harder second.'),
  ('cardio', 'beginner',    'If you can hold a conversation, you are in the right zone for building base fitness.'),
  ('cardio', 'intermediate', 'Vary your intensity. Steady state one day, intervals the next.'),

  -- GENERAL
  (null, null,              'Track your rest time between sets. Consistent rest = consistent results.'),
  (null, 'beginner',        'You will not overtrain by coming 3 days a week. But you will underprogress by skipping.'),
  (null, 'advanced',        'Deloads are not weakness. They are how you make the next training block more effective.');
