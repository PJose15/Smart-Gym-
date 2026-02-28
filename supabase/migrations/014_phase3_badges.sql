-- ============================================================================
-- Phase 3: Badges & Achievements
-- ============================================================================

-- ─── Enum Extension ─────────────────────────────────────
ALTER TYPE points_reason ADD VALUE IF NOT EXISTS 'badge_unlocked';

-- ─── Badge Definitions Table ────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  criteria_type TEXT NOT NULL CHECK (criteria_type IN (
    'first_workout',
    'workouts_10', 'workouts_50', 'workouts_100',
    'streak_4', 'streak_12',
    'total_volume_10k', 'total_volume_100k',
    'prs_5', 'prs_25',
    'points_500', 'points_5000'
  )),
  criteria_value INT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_badges_slug ON badges(slug);

-- ─── Member Badges Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_member_badges_profile ON member_badges(profile_id, unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_badges_badge ON member_badges(badge_id);

-- ─── RLS: badges ────────────────────────────────────────
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY badges_select ON badges
  FOR SELECT TO authenticated
  USING (gym_id IS NULL OR gym_id IN (
    SELECT gym_id FROM gym_members WHERE profile_id = auth.uid()
  ));

CREATE POLICY badges_insert ON badges
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM gym_members WHERE profile_id = auth.uid() AND role = 'owner'
  ));

-- ─── RLS: member_badges ────────────────────────────────
ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_badges_select_own ON member_badges
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR gym_id IN (
      SELECT gym_id FROM gym_members WHERE profile_id = auth.uid() AND role IN ('owner', 'trainer')
    )
  );

CREATE POLICY member_badges_insert_own ON member_badges
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- ─── RPC: get_total_volume ──────────────────────────────
CREATE OR REPLACE FUNCTION get_total_volume(p_profile_id UUID, p_gym_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(s.weight_kg * s.reps), 0)::BIGINT
  FROM sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workouts w ON w.id = we.workout_id
  WHERE w.profile_id = p_profile_id
    AND w.gym_id = p_gym_id
    AND w.status = 'completed';
$$;

-- ─── Seed: 12 Badges ───────────────────────────────────
INSERT INTO badges (slug, name, description, icon_emoji, criteria_type, criteria_value, rarity, sort_order) VALUES
  ('first_workout',      'First Step',       'Complete your first workout',         '👟', 'first_workout',      1,      'common',    1),
  ('workouts_10',        'Getting Serious',  'Complete 10 workouts',                '💪', 'workouts_10',        10,     'common',    2),
  ('workouts_50',        'Dedicated',        'Complete 50 workouts',                '🏋️', 'workouts_50',        50,     'rare',      3),
  ('workouts_100',       'Century Club',     'Complete 100 workouts',               '💯', 'workouts_100',       100,    'epic',      4),
  ('streak_4',           'Month Strong',     'Maintain a 4-week workout streak',    '🔥', 'streak_4',           4,      'common',    5),
  ('streak_12',          'Unstoppable',      'Maintain a 12-week workout streak',   '⚡', 'streak_12',          12,     'epic',      6),
  ('total_volume_10k',   'Ten Tonner',       'Lift a total of 10,000 kg',           '🏗️', 'total_volume_10k',   10000,  'rare',      7),
  ('total_volume_100k',  'Iron Mountain',    'Lift a total of 100,000 kg',          '🏔️', 'total_volume_100k',  100000, 'legendary', 8),
  ('prs_5',              'Record Breaker',   'Achieve 5 personal records',          '📈', 'prs_5',              5,      'common',    9),
  ('prs_25',             'PR Machine',       'Achieve 25 personal records',         '🏆', 'prs_25',             25,     'rare',      10),
  ('points_500',         'Point Collector',  'Earn 500 points',                     '⭐', 'points_500',         500,    'common',    11),
  ('points_5000',        'Elite Scorer',     'Earn 5,000 points',                   '🌟', 'points_5000',        5000,   'epic',      12)
ON CONFLICT (slug) DO NOTHING;

-- ─── Feature Flag ───────────────────────────────────────
INSERT INTO feature_flags (key, enabled) VALUES ('badges_enabled', true)
ON CONFLICT DO NOTHING;
