-- ═══════════════════════════════════════════════════════════════════
-- Migration 039: seed the feature-flag keys the mobile app checks (MOB-C1)
-- ═══════════════════════════════════════════════════════════════════
-- isFeatureEnabled() returns false for any key not present in feature_flags.
-- The mobile app checks 15 keys that were NEVER seeded (zero overlap with the
-- 7 web keys), so streaks, badges, leaderboard, push, and every AI feature were
-- permanently OFF. Seed them enabled (super-admin can toggle later).
-- ai_trainer_copilot was already seeded in migration 038.
--
-- Naming note: mobile uses `push_notifications` while the web dispatcher checks
-- the pre-existing `push_notifications_enabled` — both are seeded; unifying the
-- key names is deferred to avoid touching many call sites here.
--
-- Rollback: DELETE FROM feature_flags WHERE flag_key IN (...the keys below...).

INSERT INTO feature_flags (flag_key, is_enabled, description) VALUES
  ('streaks_enabled',        true,  'Mobile: workout streak tracking + display'),
  ('badges_enabled',         true,  'Mobile: achievement badges'),
  ('leaderboard_enabled',    true,  'Mobile: gym leaderboard'),
  ('why_this_today_enabled', true,  'Mobile: "why this workout today" explanations'),
  ('training_profile_enabled', true, 'Mobile: training-profile onboarding + settings'),
  ('push_notifications',     true,  'Mobile: push notification registration + delivery'),
  ('ai_assist',              true,  'Mobile: AI assist (machine tips)'),
  ('ai_assist_enabled',      true,  'Mobile: AI assist during workout logging'),
  ('ai_coaching',            true,  'Mobile: AI coaching insights'),
  ('ai_summary',             true,  'Mobile: AI post-workout summary'),
  ('ai_guardrails',          true,  'Mobile: AI safety guardrails'),
  ('ai_form_checklist',      true,  'Mobile: AI form checklist'),
  ('ai_safety_loop',         true,  'Mobile: AI safety feedback loop'),
  ('ai_machine_alternatives', true, 'Mobile: AI machine alternative suggestions')
ON CONFLICT (flag_key) DO NOTHING;
