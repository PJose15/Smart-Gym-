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

INSERT INTO machines (gym_id, name, qr_slug, target_muscles, setup_steps, safety_cues) VALUES
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
    ]
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
    ]
  );
