-- Phase 9 — Seed default platform feature flags
INSERT INTO feature_flags (flag_key, is_enabled, description) VALUES
  ('ai_chat_enabled',             true,  'Enable AI chat and next-set suggestions'),
  ('social_feed_enabled',         true,  'Enable the social activity feed'),
  ('ai_program_generation',       true,  'Enable AI-powered program generation'),
  ('global_leaderboard',          false, 'Enable the global cross-gym leaderboard'),
  ('push_notifications_enabled',  true,  'Enable push notifications'),
  ('uptimizeai_agents_enabled',   true,  'Enable UptimizeAI agent webhooks'),
  ('new_gym_registrations',       true,  'Allow new gym sign-ups')
ON CONFLICT (flag_key) DO NOTHING;
