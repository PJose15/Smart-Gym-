-- Migration 022: Badge compatibility views
-- Code references 'badges' and 'member_badges' but actual tables
-- are 'achievement_definitions' and 'member_achievements'.

CREATE OR REPLACE VIEW badges AS
SELECT
  id,
  code,
  title,
  description,
  category,
  points,
  required_value,
  required_unit,
  icon_name,
  created_at
FROM achievement_definitions;

CREATE OR REPLACE VIEW member_badges AS
SELECT
  id,
  member_id,
  gym_id,
  achievement_code,
  context_data,
  earned_at
FROM member_achievements;
