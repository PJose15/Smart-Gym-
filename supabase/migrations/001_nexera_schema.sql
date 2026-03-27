-- ============================================================
-- NEXERA (SmartGym) — Complete Database Schema
-- Source of truth: DOC_20_DATABASE_MASTER.md
-- Run top to bottom — every table, column, constraint,
-- index, RLS policy, and stored function
-- Version 1.0 — March 2026
-- ============================================================

-- ============================================================
-- SECTION 01 — EXTENSIONS AND SETUP
-- ============================================================

-- uuid-ossp and pgcrypto are pre-installed in Supabase (extensions schema)
-- We use gen_random_uuid() which is built-in since PG 13

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — skipping';
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_net";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available — skipping';
END $$;

SET timezone = 'America/Puerto_Rico';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 02 — CORE IDENTITY TABLES
-- ============================================================

CREATE TABLE users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE,
  phone         text,
  display_name  text NOT NULL,
  first_name    text,
  avatar_url    text,
  platform_role text NOT NULL DEFAULT 'member'
    CHECK (platform_role IN ('super_admin','gym_owner','trainer','member')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE gym_chains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  owner_id   uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gyms (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  slug                 text UNIQUE NOT NULL,
  owner_id             uuid REFERENCES users(id),
  chain_id             uuid REFERENCES gym_chains(id),

  -- Profile
  gym_type             text DEFAULT 'independent'
    CHECK (gym_type IN (
      'independent','crossfit','martial-arts','yoga',
      'personal-training','corporate','other'
    )),
  description          text,
  member_count_estimate text,
  address              text,
  city                 text,
  country              text NOT NULL DEFAULT 'US',
  phone                text,
  website              text,
  instagram            text,
  logo_url             text,

  -- Subscription
  subscription_tier    text NOT NULL DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter','growth','pro')),
  subscription_status  text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN (
      'trial','active','past_due','cancelled','payment_required'
    )),

  -- Status
  is_active            boolean NOT NULL DEFAULT true,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER gyms_updated_at
  BEFORE UPDATE ON gyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECTION 03 — MEMBERSHIP AND ROLES
-- ============================================================

CREATE TABLE gym_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id      uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  role        text NOT NULL
    CHECK (role IN ('owner','trainer','member')),
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','cancelled','inactive')),
  permissions jsonb NOT NULL DEFAULT '{}',
  invited_by  uuid REFERENCES users(id),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gym_id)
);

CREATE TABLE trainer_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  email         text NOT NULL,
  trainer_name  text NOT NULL,
  invited_by    uuid REFERENCES users(id),
  token         text UNIQUE NOT NULL,
  permissions   jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 04 — GYM CONFIGURATION
-- ============================================================

CREATE TABLE gym_settings (
  id                                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                                uuid UNIQUE NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Branding (Pro tier)
  primary_color                         text DEFAULT '#3B8BD4',
  secondary_color                       text DEFAULT '#0f0f14',
  font_preference                       text DEFAULT 'system',
  custom_domain                         text,
  hide_smartgym_branding                boolean NOT NULL DEFAULT false,
  show_public_profile                   boolean NOT NULL DEFAULT true,
  show_public_stats                     boolean NOT NULL DEFAULT true,
  public_profile_headline               text,

  -- Member experience
  require_member_photo                  boolean NOT NULL DEFAULT false,
  allow_anonymous_logging               boolean NOT NULL DEFAULT false,
  show_gym_feed                         boolean NOT NULL DEFAULT true,
  show_leaderboards                     boolean NOT NULL DEFAULT true,
  leaderboard_scope                     text NOT NULL DEFAULT 'gym'
    CHECK (leaderboard_scope IN ('gym','global','both')),
  enable_member_chat_with_ai            boolean NOT NULL DEFAULT true,

  -- AI program settings
  ai_program_auto_generate              boolean NOT NULL DEFAULT true,
  trainer_must_approve_ai_programs      boolean NOT NULL DEFAULT false,
  program_duration_weeks                integer NOT NULL DEFAULT 4
    CHECK (program_duration_weeks IN (4,6,8,12)),
  default_maintenance_interval_days     integer NOT NULL DEFAULT 90,

  -- At-risk threshold
  at_risk_threshold_days                integer NOT NULL DEFAULT 14
    CHECK (at_risk_threshold_days BETWEEN 7 AND 30),

  -- Trainer defaults
  default_trainer_can_create_challenges boolean NOT NULL DEFAULT false,
  default_trainer_can_manage_all        boolean NOT NULL DEFAULT false,
  default_trainer_can_view_analytics    boolean NOT NULL DEFAULT false,

  -- Owner notifications
  owner_daily_digest                    boolean NOT NULL DEFAULT true,
  owner_at_risk_alerts                  boolean NOT NULL DEFAULT true,
  owner_new_member_notification         boolean NOT NULL DEFAULT true,
  owner_pr_notifications                boolean NOT NULL DEFAULT false,
  owner_monthly_report                  boolean NOT NULL DEFAULT true,
  owner_maintenance_alerts              boolean NOT NULL DEFAULT true,

  -- Equipment
  equipment_maintenance_alerts          boolean NOT NULL DEFAULT true,
  maintenance_alert_days_ahead          integer NOT NULL DEFAULT 7,

  -- Operational
  gym_open_time                         time DEFAULT '05:00',
  gym_close_time                        time DEFAULT '23:00',
  timezone                              text NOT NULL DEFAULT 'America/Puerto_Rico',
  currency                              text NOT NULL DEFAULT 'USD',
  weight_unit                           text NOT NULL DEFAULT 'lbs'
    CHECK (weight_unit IN ('lbs','kg')),

  created_at                            timestamptz NOT NULL DEFAULT now(),
  updated_at                            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER gym_settings_updated_at
  BEFORE UPDATE ON gym_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE gym_agent_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  agent_id      text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  custom_config jsonb NOT NULL DEFAULT '{}',
  last_fired_at timestamptz,
  fire_count    integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gym_id, agent_id)
);

CREATE TABLE gym_billing (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                 uuid UNIQUE NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text,
  stripe_price_id        text,
  tier                   text NOT NULL DEFAULT 'starter',
  billing_interval       text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','annual')),
  subscription_status    text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'active','trialing','past_due','cancelled',
      'incomplete','incomplete_expired','unpaid','paused'
    )),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER gym_billing_updated_at
  BEFORE UPDATE ON gym_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECTION 05 — MACHINE CATALOG
-- ============================================================

CREATE TABLE machines (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                    uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  brand                     text,
  model                     text,
  category                  text NOT NULL DEFAULT 'strength'
    CHECK (category IN ('strength','cardio','cable','functional','other')),
  muscle_groups             text[] NOT NULL DEFAULT '{}',
  instructions              text,
  demo_image_url            text,
  demo_video_url            text,
  location_in_gym           text,
  qr_slug                   text UNIQUE NOT NULL,
  qr_code_url               text,
  purchase_price            numeric(10,2),
  purchase_date             date,
  last_maintenance_date     date,
  maintenance_interval_days integer NOT NULL DEFAULT 90,
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE machine_scan_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id      uuid REFERENCES machines(id) ON DELETE SET NULL,
  member_id       uuid,
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  workout_mode    text,
  was_in_program  boolean NOT NULL DEFAULT false,
  led_to_log      boolean NOT NULL DEFAULT false
);

-- ============================================================
-- SECTION 06 — MEMBER PROFILE TABLES
-- ============================================================

CREATE TABLE members (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                  uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id                 uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name            text NOT NULL,
  first_name              text,
  phone                   text,
  email                   text,
  date_of_birth           date,
  avatar_url              text,

  -- Training profile
  primary_goal            text DEFAULT 'general-fitness'
    CHECK (primary_goal IN (
      'muscle-gain','strength','weight-loss',
      'endurance','general-fitness'
    )),
  experience_level        text DEFAULT 'beginner'
    CHECK (experience_level IN ('beginner','intermediate','advanced','athlete')),
  injuries_or_limitations text,

  -- Trainer assignment
  assigned_trainer_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  trainer_assigned_at     timestamptz,
  trainer_assigned_by     uuid REFERENCES users(id),

  -- Onboarding
  onboarding_status       text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN (
      'pending','in_progress','intake_complete',
      'active','program_generating','program_active'
    )),

  -- Status
  is_active               boolean NOT NULL DEFAULT true,
  status                  text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','cancelled','pending')),
  status_changed_at       timestamptz,
  status_change_reason    text,
  status_changed_by       uuid REFERENCES users(id),

  -- Gamification
  smartgym_score          integer NOT NULL DEFAULT 0,
  current_streak          integer NOT NULL DEFAULT 0,
  best_streak             integer NOT NULL DEFAULT 0,
  streak_last_updated     date,
  last_session_date       date,
  leveled_up_at           timestamptz,

  -- Timestamps
  joined_gym_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE member_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                   uuid UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  weight_unit                 text NOT NULL DEFAULT 'lbs'
    CHECK (weight_unit IN ('lbs','kg')),
  date_format                 text NOT NULL DEFAULT 'MM/DD/YYYY',
  profile_visible             boolean NOT NULL DEFAULT true,
  show_on_leaderboard         boolean NOT NULL DEFAULT true,
  share_achievements          boolean NOT NULL DEFAULT true,
  share_prs_to_feed           boolean NOT NULL DEFAULT true,
  show_streak_publicly        boolean NOT NULL DEFAULT true,
  share_weight_with_trainer   boolean NOT NULL DEFAULT false,
  share_workout_with_trainer  boolean NOT NULL DEFAULT true,
  show_body_weight            boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE body_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  logged_at        timestamptz NOT NULL DEFAULT now(),
  weight_lbs       numeric(6,2),
  body_fat_pct     numeric(5,2),
  chest_in         numeric(5,2),
  waist_in         numeric(5,2),
  hips_in          numeric(5,2),
  left_arm_in      numeric(5,2),
  right_arm_in     numeric(5,2),
  left_thigh_in    numeric(5,2),
  right_thigh_in   numeric(5,2),
  left_calf_in     numeric(5,2),
  right_calf_in    numeric(5,2),
  neck_in          numeric(5,2),
  shoulders_in     numeric(5,2),
  notes            text
);

CREATE TABLE member_status_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id       uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  old_status   text,
  new_status   text NOT NULL,
  reason       text,
  changed_by   uuid REFERENCES users(id),
  changed_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 07 — WORKOUT AND SESSION TABLES
-- ============================================================

CREATE TABLE workout_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id               uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  machine_id           uuid REFERENCES machines(id) ON DELETE SET NULL,
  member_id            uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  session_date         date NOT NULL,
  workout_mode         text NOT NULL DEFAULT 'free'
    CHECK (workout_mode IN ('ai_program','trainer_program','free')),

  -- Sets data
  sets                 jsonb NOT NULL DEFAULT '[]',
  sets_count           integer NOT NULL DEFAULT 0,
  total_volume_lbs     numeric(10,2) NOT NULL DEFAULT 0,
  best_weight_lbs      numeric(8,2),
  best_reps            integer,

  -- PR tracking
  is_personal_best     boolean NOT NULL DEFAULT false,
  personal_best_type   text
    CHECK (personal_best_type IN ('first_session','weight','volume',NULL)),
  pr_improvement_lbs   numeric(8,2),
  pr_improvement_pct   numeric(6,2),
  previous_best_lbs    numeric(8,2),

  -- AI context
  ai_tip_shown         text,
  ai_tip_source        text,

  -- Timestamps
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER workout_sessions_updated_at
  BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE session_overrides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  program_id       uuid,  -- FK added after ai_programs table
  override_date    date NOT NULL,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 08 — AI AND PROGRAM TABLES
-- ============================================================

CREATE TABLE ai_programs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  goal                text NOT NULL,
  experience_level    text NOT NULL,
  duration_weeks      integer NOT NULL DEFAULT 4,
  sessions_per_week   integer NOT NULL DEFAULT 3,
  focus               text,

  -- Program structure stored as JSON
  program_data        jsonb NOT NULL DEFAULT '{}',

  -- Progress tracking
  week_number         integer NOT NULL DEFAULT 1,
  day_number          integer NOT NULL DEFAULT 1,
  sessions_completed  integer NOT NULL DEFAULT 0,
  sessions_total      integer NOT NULL DEFAULT 0,
  sessions_behind     integer NOT NULL DEFAULT 0,
  prs_hit             integer NOT NULL DEFAULT 0,
  total_volume_lbs    numeric(12,2) NOT NULL DEFAULT 0,
  on_track            boolean NOT NULL DEFAULT true,

  -- Metadata
  generated_by        text NOT NULL DEFAULT 'ai'
    CHECK (generated_by IN ('ai','trainer')),
  trainer_approved    boolean NOT NULL DEFAULT false,
  trainer_approved_at timestamptz,
  trainer_approved_by uuid REFERENCES users(id),

  -- Status
  is_active           boolean NOT NULL DEFAULT true,
  completed_at        timestamptz,
  just_completed      boolean NOT NULL DEFAULT false,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ai_programs_updated_at
  BEFORE UPDATE ON ai_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add forward reference from session_overrides to ai_programs
ALTER TABLE session_overrides
  ADD CONSTRAINT session_overrides_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES ai_programs(id) ON DELETE SET NULL;

CREATE TABLE ai_tip_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  machine_id   uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  cache_date   date NOT NULL,
  tip_text     text NOT NULL,
  tip_source   text NOT NULL DEFAULT 'ai'
    CHECK (tip_source IN ('ai','library','cache','static')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, machine_id, cache_date)
);

CREATE TABLE ai_coaching_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id         uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  message_role   text NOT NULL CHECK (message_role IN ('user','assistant')),
  message_text   text NOT NULL,
  injury_flagged boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tip_library (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_category text,  -- null = applies to all categories
  experience_level text,
  tip_text         text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smartgym_agent_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid REFERENCES gyms(id) ON DELETE SET NULL,
  member_id      uuid REFERENCES members(id) ON DELETE SET NULL,
  agent_name     text NOT NULL,
  trigger_event  text NOT NULL,
  action_taken   text,
  channel        text,
  status         text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','failed','pending','skipped')),
  error_message  text,
  payload        jsonb,
  executed_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 09 — GAMIFICATION TABLES
-- ============================================================

CREATE TABLE achievement_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  category        text NOT NULL
    CHECK (category IN ('milestone','performance','consistency','explorer','community')),
  points          integer NOT NULL DEFAULT 0,
  required_value  integer,
  required_unit   text,
  icon_name       text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  achievement_code text NOT NULL REFERENCES achievement_definitions(code),
  context_data     jsonb NOT NULL DEFAULT '{}',
  earned_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, achievement_code)
);

CREATE TABLE member_leaderboard_positions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  leaderboard_type  text NOT NULL
    CHECK (leaderboard_type IN (
      'volume-weekly','sessions-weekly',
      'prs-monthly','streak-live','score-alltime'
    )),
  current_rank      integer NOT NULL,
  previous_rank     integer,
  current_value     numeric(12,2) NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, gym_id, leaderboard_type)
);

CREATE TABLE leaderboard_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  leaderboard_type text NOT NULL,
  snapshot_date    date NOT NULL,
  rankings         jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gym_id, leaderboard_type, snapshot_date)
);

CREATE TABLE gym_challenges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id             uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  created_by         uuid REFERENCES users(id),
  title              text NOT NULL,
  description        text,
  challenge_type     text NOT NULL
    CHECK (challenge_type IN (
      'volume','sessions','machine_explorer',
      'pr','streak','team','custom'
    )),
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  entry_mode         text NOT NULL DEFAULT 'open'
    CHECK (entry_mode IN ('open','opt-in','invite')),
  prize_type         text,
  prize_description  text,
  top_score          numeric(12,2) NOT NULL DEFAULT 0,
  gap_to_next_rank   text,
  next_rank_score    numeric(12,2),
  is_active          boolean NOT NULL DEFAULT true,
  winner_member_id   uuid REFERENCES members(id),
  winner_name        text,
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES gym_challenges(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  current_score   numeric(12,2) NOT NULL DEFAULT 0,
  current_rank    integer NOT NULL DEFAULT 0,
  final_rank      integer,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, member_id)
);

CREATE TABLE challenge_teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES gym_challenges(id) ON DELETE CASCADE,
  team_name    text NOT NULL,
  team_score   numeric(12,2) NOT NULL DEFAULT 0,
  member_ids   uuid[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_milestone_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id   uuid NOT NULL REFERENCES gym_challenges(id) ON DELETE CASCADE,
  member_id      uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  milestone_type text NOT NULL
    CHECK (milestone_type IN ('joined','rank_1','podium','rank_change')),
  old_rank       integer,
  new_rank       integer,
  logged_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 10 — SOCIAL AND COMMUNITY TABLES
-- ============================================================

CREATE TABLE gym_feed_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id     uuid REFERENCES members(id) ON DELETE SET NULL,
  event_type    text NOT NULL
    CHECK (event_type IN (
      'pr_weight','pr_volume','streak_milestone',
      'program_complete','session_milestone','level_up',
      'achievement_earned','challenge_launched','challenge_joined',
      'challenge_rank_1','challenge_podium','challenge_complete',
      'member_spotlight','gym_announcement','new_member','goal_reached'
    )),
  display_text  text NOT NULL,
  context_data  jsonb NOT NULL DEFAULT '{}',
  priority      text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('high','medium','low')),
  is_pinned     boolean NOT NULL DEFAULT false,
  comment_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feed_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES gym_feed_events(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reaction_type text NOT NULL
    CHECK (reaction_type IN ('strength','fire','champion','letsgo')),
  reacted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, member_id, reaction_type)
);

CREATE TABLE feed_comments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid NOT NULL REFERENCES gym_feed_events(id) ON DELETE CASCADE,
  member_id            uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  comment_text         text NOT NULL,
  mentioned_member_ids uuid[] NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_spotlight_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  spotlight_trigger text NOT NULL,
  event_id          uuid REFERENCES gym_feed_events(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, spotlight_trigger)
);

-- ============================================================
-- SECTION 11 — NOTIFICATION TABLES
-- ============================================================

CREATE TABLE push_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id         uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  endpoint       text NOT NULL,
  p256dh         text NOT NULL,
  auth           text NOT NULL,
  user_agent     text,
  platform       text
    CHECK (platform IN ('ios','android','desktop')),
  is_active      boolean NOT NULL DEFAULT true,
  subscribed_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  last_failed_at timestamptz,
  failure_count  integer NOT NULL DEFAULT 0,
  UNIQUE(member_id, endpoint)
);

CREATE TABLE notification_preferences (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               uuid UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Push notifications
  push_prs                boolean NOT NULL DEFAULT true,
  push_achievements       boolean NOT NULL DEFAULT true,
  push_level_up           boolean NOT NULL DEFAULT true,
  push_challenge_rank     boolean NOT NULL DEFAULT true,
  push_new_program        boolean NOT NULL DEFAULT true,
  push_trainer_note       boolean NOT NULL DEFAULT true,
  push_gym_feed           boolean NOT NULL DEFAULT false,

  -- SMS
  sms_re_engagement       boolean NOT NULL DEFAULT true,
  sms_streak_milestone    boolean NOT NULL DEFAULT true,
  sms_challenge_reminder  boolean NOT NULL DEFAULT true,
  sms_weekly_summary      boolean NOT NULL DEFAULT true,
  sms_pr_celebration      boolean NOT NULL DEFAULT true,
  sms_trainer_message     boolean NOT NULL DEFAULT true,
  sms_gym_announcement    boolean NOT NULL DEFAULT true,

  -- Email
  email_weekly_summary    boolean NOT NULL DEFAULT true,
  email_monthly_report    boolean NOT NULL DEFAULT false,
  email_gym_newsletter    boolean NOT NULL DEFAULT false,

  -- Quiet hours
  quiet_hours_enabled     boolean NOT NULL DEFAULT false,
  quiet_hours_start       time DEFAULT '22:00',
  quiet_hours_end         time DEFAULT '07:00',

  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title             text NOT NULL,
  body              text NOT NULL,
  data              jsonb NOT NULL DEFAULT '{}',
  channel           text NOT NULL
    CHECK (channel IN ('push','sms','email','in-app')),
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed')),
  sent_at           timestamptz,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_analytics (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id             uuid REFERENCES notifications(id) ON DELETE CASCADE,
  member_id                   uuid REFERENCES members(id) ON DELETE CASCADE,
  gym_id                      uuid REFERENCES gyms(id) ON DELETE CASCADE,
  event_type                  text NOT NULL
    CHECK (event_type IN ('shown','tapped','dismissed','action_clicked')),
  action_taken                text,
  device_platform             text,
  time_to_interaction_seconds integer,
  occurred_at                 timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 12 — TRAINER TABLES
-- ============================================================

CREATE TABLE trainer_preferences (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id                      uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_on_session               boolean NOT NULL DEFAULT false,
  notify_on_pr                    boolean NOT NULL DEFAULT true,
  notify_on_program_complete      boolean NOT NULL DEFAULT true,
  notify_on_at_risk               boolean NOT NULL DEFAULT true,
  notify_on_injury                boolean NOT NULL DEFAULT true,
  notify_on_message               boolean NOT NULL DEFAULT true,
  notify_on_program_review        boolean NOT NULL DEFAULT true,
  auto_accept_assignments         boolean NOT NULL DEFAULT true,
  default_program_duration_weeks  integer NOT NULL DEFAULT 4,
  always_review_ai_programs       boolean NOT NULL DEFAULT false,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trainer_member_notes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id              uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                 uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  note_type              text NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('general','form','injury','progress','program')),
  note_text              text NOT NULL,
  session_id             uuid REFERENCES workout_sessions(id) ON DELETE SET NULL,
  is_visible_to_member   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trainer_member_messages (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id               uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                  uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sender_type             text NOT NULL
    CHECK (sender_type IN ('trainer','member')),
  message_text            text NOT NULL,
  sent_at                 timestamptz NOT NULL DEFAULT now(),
  read_at                 timestamptz,
  is_deleted_by_trainer   boolean NOT NULL DEFAULT false,
  is_deleted_by_member    boolean NOT NULL DEFAULT false
);

-- ============================================================
-- SECTION 13 — ANALYTICS AND LOGGING TABLES
-- ============================================================

CREATE TABLE error_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code      text NOT NULL,
  error_message   text NOT NULL,
  stack_trace     text,
  context         text NOT NULL,
  member_id       uuid REFERENCES members(id) ON DELETE SET NULL,
  gym_id          uuid REFERENCES gyms(id) ON DELETE SET NULL,
  additional_data jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  environment     text,
  app_version     text,
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     text
);

CREATE TABLE onboarding_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  gym_id      uuid REFERENCES gyms(id) ON DELETE SET NULL,
  member_id   uuid REFERENCES members(id) ON DELETE SET NULL,
  event_type  text NOT NULL
    CHECK (event_type IN (
      'qr_scan','start_tracking_tapped','name_submitted',
      'otp_sent','otp_verified','otp_failed','otp_resent',
      'goal_selected','experience_selected','welcome_seen',
      'first_set_logged','pwa_prompted','pwa_installed','pwa_dismissed',
      'program_generated','program_viewed'
    )),
  event_data  jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_daily_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  date UNIQUE NOT NULL,
  total_gyms            integer NOT NULL DEFAULT 0,
  total_active_gyms     integer NOT NULL DEFAULT 0,
  total_members         integer NOT NULL DEFAULT 0,
  total_sessions        integer NOT NULL DEFAULT 0,
  new_gyms              integer NOT NULL DEFAULT 0,
  churned_gyms          integer NOT NULL DEFAULT 0,
  ai_tips_generated     integer NOT NULL DEFAULT 0,
  ai_programs_generated integer NOT NULL DEFAULT 0,
  openai_cost_usd       numeric(10,4) NOT NULL DEFAULT 0,
  mrr_usd               numeric(10,2) NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_performance_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint         text NOT NULL,
  method           text NOT NULL,
  response_time_ms integer NOT NULL,
  status_code      integer NOT NULL,
  gym_id           uuid REFERENCES gyms(id) ON DELETE SET NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym_profile_views (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  source       text,
  visitor_type text,
  converted    boolean NOT NULL DEFAULT false
);

CREATE TABLE gym_partner_kit_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id             uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  asset_id           text NOT NULL,
  asset_name         text NOT NULL,
  download_url       text NOT NULL,
  preview_url        text,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  download_count     integer NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  UNIQUE(gym_id, asset_id)
);

-- ============================================================
-- SECTION 14 — ADMIN TABLES
-- ============================================================

CREATE TABLE feature_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key     text UNIQUE NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT true,
  description  text,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_actions_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  action_type    text NOT NULL,
  target_type    text,
  target_id      text,
  details        jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by         uuid REFERENCES users(id),
  audience        text NOT NULL,
  channel         text NOT NULL,
  subject         text,
  message_text    text NOT NULL,
  recipient_count integer,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 15 — ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tip_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartgym_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_leaderboard_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_milestone_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_feed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_spotlight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_member_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_member_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_performance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_partner_kit_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;

-- ── RLS HELPER FUNCTIONS ─────────────────────────────────────

CREATE OR REPLACE FUNCTION is_gym_owner(p_gym_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM gym_memberships
    WHERE user_id = auth.uid()
      AND gym_id = p_gym_id
      AND role = 'owner'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_gym_trainer(p_gym_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM gym_memberships
    WHERE user_id = auth.uid()
      AND gym_id = p_gym_id
      AND role = 'trainer'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_gym_member(p_gym_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM gym_memberships
    WHERE user_id = auth.uid()
      AND gym_id = p_gym_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION owned_gym_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT gym_id FROM gym_memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_member_id(p_gym_id uuid)
RETURNS uuid AS $$
  SELECT id FROM members
  WHERE user_id = auth.uid()
    AND gym_id = p_gym_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND platform_role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── USERS ────────────────────────────────────────────────────

CREATE POLICY "users_own_profile"
  ON users FOR ALL
  USING (id = auth.uid());

CREATE POLICY "super_admin_users"
  ON users FOR ALL
  USING (is_super_admin());

-- ── GYMS ────────────────────────────────────────────────────

CREATE POLICY "gym_public_read"
  ON gyms FOR SELECT
  USING (is_active = true);

CREATE POLICY "gym_owner_write"
  ON gyms FOR UPDATE
  USING (is_gym_owner(id));

CREATE POLICY "super_admin_gyms"
  ON gyms FOR ALL
  USING (is_super_admin());

-- ── GYM MEMBERSHIPS ──────────────────────────────────────────

CREATE POLICY "gym_memberships_own"
  ON gym_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "gym_memberships_owner_read"
  ON gym_memberships FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "gym_memberships_owner_write"
  ON gym_memberships FOR INSERT
  WITH CHECK (gym_id = ANY(owned_gym_ids()));

-- ── MACHINES ────────────────────────────────────────────────

CREATE POLICY "machines_public_read"
  ON machines FOR SELECT
  USING (is_active = true);

CREATE POLICY "machines_owner_write"
  ON machines FOR ALL
  USING (is_gym_owner(gym_id));

-- ── MEMBERS ─────────────────────────────────────────────────

CREATE POLICY "members_own_profile"
  ON members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "members_owner_read"
  ON members FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "members_owner_write"
  ON members FOR ALL
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "members_trainer_assigned_read"
  ON members FOR SELECT
  USING (
    assigned_trainer_id = auth.uid()
    OR (
      is_gym_trainer(gym_id)
      AND (
        SELECT (permissions->>'can_manage_all_members')::boolean
        FROM gym_memberships
        WHERE user_id = auth.uid()
          AND gym_id = members.gym_id
        LIMIT 1
      ) = true
    )
  );

-- ── WORKOUT SESSIONS ────────────────────────────────────────

CREATE POLICY "sessions_own"
  ON workout_sessions FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "sessions_owner_read"
  ON workout_sessions FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "sessions_trainer_read"
  ON workout_sessions FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assigned_trainer_id = auth.uid()
    )
  );

-- ── AI PROGRAMS ─────────────────────────────────────────────

CREATE POLICY "programs_own"
  ON ai_programs FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "programs_trainer"
  ON ai_programs FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members
      WHERE assigned_trainer_id = auth.uid()
    )
  );

CREATE POLICY "programs_owner_read"
  ON ai_programs FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- ── BODY METRICS ─────────────────────────────────────────────

CREATE POLICY "body_metrics_own_only"
  ON body_metrics FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ── ACHIEVEMENTS ────────────────────────────────────────────

CREATE POLICY "achievement_defs_public"
  ON achievement_definitions FOR SELECT
  USING (is_active = true);

CREATE POLICY "member_achievements_own"
  ON member_achievements FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "member_achievements_gym_read"
  ON member_achievements FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- ── GYM FEED ────────────────────────────────────────────────

CREATE POLICY "feed_gym_members_read"
  ON gym_feed_events FOR SELECT
  USING (is_gym_member(gym_id));

CREATE POLICY "feed_owner_write"
  ON gym_feed_events FOR INSERT
  WITH CHECK (gym_id = ANY(owned_gym_ids()));

-- ── FEED REACTIONS AND COMMENTS ────────────────────────────

CREATE POLICY "reactions_gym_members"
  ON feed_reactions FOR ALL
  USING (
    event_id IN (
      SELECT id FROM gym_feed_events
      WHERE is_gym_member(gym_id)
    )
  );

CREATE POLICY "comments_gym_members"
  ON feed_comments FOR ALL
  USING (
    event_id IN (
      SELECT id FROM gym_feed_events
      WHERE is_gym_member(gym_id)
    )
  );

-- ── LEADERBOARDS ────────────────────────────────────────────

CREATE POLICY "leaderboard_gym_members_read"
  ON member_leaderboard_positions FOR SELECT
  USING (is_gym_member(gym_id));

-- ── CHALLENGES ──────────────────────────────────────────────

CREATE POLICY "challenges_gym_members_read"
  ON gym_challenges FOR SELECT
  USING (is_gym_member(gym_id));

CREATE POLICY "challenges_owner_write"
  ON gym_challenges FOR ALL
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "challenge_participants_own"
  ON challenge_participants FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "challenge_participants_gym_read"
  ON challenge_participants FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- ── NOTIFICATIONS ───────────────────────────────────────────

CREATE POLICY "notifications_own"
  ON notifications FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "push_subscriptions_own"
  ON push_subscriptions FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "notification_prefs_own"
  ON notification_preferences FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ── MEMBER SETTINGS ─────────────────────────────────────────

CREATE POLICY "member_settings_own"
  ON member_settings FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ── GYM SETTINGS ────────────────────────────────────────────

CREATE POLICY "gym_settings_owner"
  ON gym_settings FOR ALL
  USING (gym_id = ANY(owned_gym_ids()));

CREATE POLICY "gym_settings_trainer_read"
  ON gym_settings FOR SELECT
  USING (
    is_gym_trainer(gym_id)
    AND (
      SELECT (permissions->>'can_view_business_analytics')::boolean
      FROM gym_memberships
      WHERE user_id = auth.uid()
        AND gym_id = gym_settings.gym_id
      LIMIT 1
    ) = true
  );

-- ── GYM BILLING ─────────────────────────────────────────────

CREATE POLICY "gym_billing_owner_only"
  ON gym_billing FOR ALL
  USING (gym_id = ANY(owned_gym_ids()));

-- ── TRAINER NOTES ───────────────────────────────────────────

CREATE POLICY "trainer_notes_own"
  ON trainer_member_notes FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "trainer_notes_owner_read"
  ON trainer_member_notes FOR SELECT
  USING (gym_id = ANY(owned_gym_ids()));

-- ── TRAINER MESSAGES ────────────────────────────────────────

CREATE POLICY "trainer_messages_trainer"
  ON trainer_member_messages FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "trainer_messages_member"
  ON trainer_member_messages FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ── FEATURE FLAGS ───────────────────────────────────────────

CREATE POLICY "feature_flags_public_read"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY "feature_flags_admin_write"
  ON feature_flags FOR ALL
  USING (is_super_admin());

-- ── TIP LIBRARY ─────────────────────────────────────────────

CREATE POLICY "tip_library_authenticated_read"
  ON tip_library FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- ── ERROR LOG ───────────────────────────────────────────────

CREATE POLICY "error_log_admin_only"
  ON error_log FOR ALL
  USING (is_super_admin());

-- ── PLATFORM TABLES ─────────────────────────────────────────

CREATE POLICY "platform_metrics_admin_only"
  ON platform_daily_metrics FOR ALL
  USING (is_super_admin());

CREATE POLICY "admin_actions_admin_only"
  ON admin_actions_log FOR ALL
  USING (is_super_admin());

CREATE POLICY "platform_announcements_admin_only"
  ON platform_announcements FOR ALL
  USING (is_super_admin());

-- ============================================================
-- SECTION 16 — INDEXES
-- ============================================================

-- ── MACHINES ─────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_machines_qr_slug
  ON machines(qr_slug);

CREATE INDEX idx_machines_gym_active
  ON machines(gym_id, is_active)
  WHERE is_active = true;

-- ── MEMBERS ──────────────────────────────────────────────────
CREATE INDEX idx_members_gym_active
  ON members(gym_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_members_user_id
  ON members(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_members_trainer
  ON members(assigned_trainer_id, gym_id)
  WHERE assigned_trainer_id IS NOT NULL;

CREATE INDEX idx_members_phone
  ON members(phone)
  WHERE phone IS NOT NULL;

-- ── WORKOUT SESSIONS ─────────────────────────────────────────
CREATE INDEX idx_sessions_member_date
  ON workout_sessions(member_id, session_date DESC);

CREATE INDEX idx_sessions_gym_date
  ON workout_sessions(gym_id, session_date DESC);

CREATE INDEX idx_sessions_machine_member
  ON workout_sessions(machine_id, member_id, session_date DESC);

CREATE INDEX idx_sessions_pr
  ON workout_sessions(member_id, is_personal_best)
  WHERE is_personal_best = true;

CREATE INDEX idx_sessions_date_only
  ON workout_sessions(session_date DESC);

-- ── AI PROGRAMS ──────────────────────────────────────────────
CREATE INDEX idx_programs_member_active
  ON ai_programs(member_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_programs_gym
  ON ai_programs(gym_id, created_at DESC);

-- ── AI TIP CACHE ─────────────────────────────────────────────
CREATE INDEX idx_tip_cache_lookup
  ON ai_tip_cache(member_id, machine_id, cache_date);

-- ── GYM MEMBERSHIPS ──────────────────────────────────────────
CREATE INDEX idx_memberships_user_role
  ON gym_memberships(user_id, role, status);

CREATE INDEX idx_memberships_gym_role
  ON gym_memberships(gym_id, role, status);

-- ── GYM FEED EVENTS ──────────────────────────────────────────
CREATE INDEX idx_feed_gym_created
  ON gym_feed_events(gym_id, created_at DESC);

CREATE INDEX idx_feed_priority
  ON gym_feed_events(gym_id, priority, created_at DESC);

CREATE INDEX idx_feed_pinned
  ON gym_feed_events(gym_id, is_pinned)
  WHERE is_pinned = true;

-- ── LEADERBOARDS ─────────────────────────────────────────────
CREATE INDEX idx_leaderboard_gym_type
  ON member_leaderboard_positions(gym_id, leaderboard_type, current_rank ASC);

-- ── CHALLENGES ───────────────────────────────────────────────
CREATE INDEX idx_challenge_participants_rank
  ON challenge_participants(challenge_id, current_rank ASC);

CREATE INDEX idx_challenges_gym_active
  ON gym_challenges(gym_id, is_active, end_date)
  WHERE is_active = true;

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE INDEX idx_notifications_member_unread
  ON notifications(member_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_member_recent
  ON notifications(member_id, created_at DESC);

-- ── PUSH SUBSCRIPTIONS ───────────────────────────────────────
CREATE INDEX idx_push_subs_member_active
  ON push_subscriptions(member_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_push_subs_gym_active
  ON push_subscriptions(gym_id, is_active)
  WHERE is_active = true;

-- ── ACHIEVEMENTS ─────────────────────────────────────────────
CREATE INDEX idx_achievements_member
  ON member_achievements(member_id, earned_at DESC);

CREATE INDEX idx_achievements_gym
  ON member_achievements(gym_id, earned_at DESC);

-- ── TRAINER MESSAGES ─────────────────────────────────────────
CREATE INDEX idx_messages_thread
  ON trainer_member_messages(trainer_id, member_id, sent_at DESC);

CREATE INDEX idx_messages_unread
  ON trainer_member_messages(trainer_id, read_at)
  WHERE read_at IS NULL;

-- ── ERROR LOG ────────────────────────────────────────────────
CREATE INDEX idx_error_log_code_time
  ON error_log(error_code, occurred_at DESC);

CREATE INDEX idx_error_log_context_time
  ON error_log(context, occurred_at DESC);

CREATE INDEX idx_error_log_unresolved
  ON error_log(occurred_at DESC, resolved)
  WHERE resolved = false;

-- ── MACHINE SCAN EVENTS ──────────────────────────────────────
CREATE INDEX idx_scan_events_gym_time
  ON machine_scan_events(gym_id, scanned_at DESC);

CREATE INDEX idx_scan_events_machine
  ON machine_scan_events(machine_id, scanned_at DESC);

-- ── API PERFORMANCE ──────────────────────────────────────────
CREATE INDEX idx_api_perf_endpoint_time
  ON api_performance_log(endpoint, occurred_at DESC);

-- ── AGENT LOGS ───────────────────────────────────────────────
CREATE INDEX idx_agent_logs_gym_time
  ON smartgym_agent_logs(gym_id, executed_at DESC)
  WHERE gym_id IS NOT NULL;

CREATE INDEX idx_agent_logs_agent_name
  ON smartgym_agent_logs(agent_name, executed_at DESC);

-- ============================================================
-- SECTION 17 — STORED FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_at_risk_members(
  p_gym_id          uuid,
  p_days_threshold  integer DEFAULT 14
)
RETURNS TABLE (
  member_id                 uuid,
  display_name              text,
  last_session_date         date,
  days_since_last_session   integer,
  total_sessions            bigint,
  phone                     text
)
LANGUAGE sql
AS $$
  SELECT
    m.id AS member_id,
    m.display_name,
    MAX(ws.session_date) AS last_session_date,
    (CURRENT_DATE - MAX(ws.session_date))::integer AS days_since_last_session,
    COUNT(ws.id) AS total_sessions,
    m.phone
  FROM members m
  LEFT JOIN workout_sessions ws ON ws.member_id = m.id
  WHERE m.gym_id = p_gym_id
    AND m.is_active = true
    AND m.onboarding_status = 'active'
  GROUP BY m.id, m.display_name, m.phone
  HAVING (CURRENT_DATE - MAX(ws.session_date))::integer >= p_days_threshold
  ORDER BY days_since_last_session DESC;
$$;

CREATE OR REPLACE FUNCTION get_gym_session_stats(
  p_gym_id    uuid,
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  stat_date           date,
  session_count       bigint,
  unique_members      bigint,
  total_volume_lbs    numeric,
  pr_count            bigint
)
LANGUAGE sql
AS $$
  SELECT
    session_date AS stat_date,
    COUNT(id) AS session_count,
    COUNT(DISTINCT member_id) AS unique_members,
    SUM(total_volume_lbs) AS total_volume_lbs,
    COUNT(*) FILTER (WHERE is_personal_best = true) AS pr_count
  FROM workout_sessions
  WHERE gym_id = p_gym_id
    AND session_date >= CURRENT_DATE - p_days_back
  GROUP BY session_date
  ORDER BY session_date ASC;
$$;

CREATE OR REPLACE FUNCTION get_member_level(p_score integer)
RETURNS TABLE (
  level_number    integer,
  level_name      text,
  points_to_next  integer,
  percentage      numeric
)
LANGUAGE sql
AS $$
  SELECT
    CASE
      WHEN p_score < 100   THEN 1
      WHEN p_score < 300   THEN 2
      WHEN p_score < 600   THEN 3
      WHEN p_score < 1000  THEN 4
      WHEN p_score < 1500  THEN 5
      WHEN p_score < 2200  THEN 6
      WHEN p_score < 3000  THEN 7
      WHEN p_score < 4500  THEN 8
      WHEN p_score < 6500  THEN 9
      ELSE 10
    END AS level_number,
    CASE
      WHEN p_score < 100   THEN 'Newcomer'
      WHEN p_score < 300   THEN 'Regular'
      WHEN p_score < 600   THEN 'Consistent'
      WHEN p_score < 1000  THEN 'Committed'
      WHEN p_score < 1500  THEN 'Dedicated'
      WHEN p_score < 2200  THEN 'Serious'
      WHEN p_score < 3000  THEN 'Advanced'
      WHEN p_score < 4500  THEN 'Elite'
      WHEN p_score < 6500  THEN 'Champion'
      ELSE 'Legend'
    END AS level_name,
    CASE
      WHEN p_score < 100   THEN 100 - p_score
      WHEN p_score < 300   THEN 300 - p_score
      WHEN p_score < 600   THEN 600 - p_score
      WHEN p_score < 1000  THEN 1000 - p_score
      WHEN p_score < 1500  THEN 1500 - p_score
      WHEN p_score < 2200  THEN 2200 - p_score
      WHEN p_score < 3000  THEN 3000 - p_score
      WHEN p_score < 4500  THEN 4500 - p_score
      WHEN p_score < 6500  THEN 6500 - p_score
      ELSE 0
    END AS points_to_next,
    CASE
      WHEN p_score < 100   THEN ROUND((p_score::numeric / 100) * 100, 1)
      WHEN p_score < 300   THEN ROUND(((p_score - 100)::numeric / 200) * 100, 1)
      WHEN p_score < 600   THEN ROUND(((p_score - 300)::numeric / 300) * 100, 1)
      WHEN p_score < 1000  THEN ROUND(((p_score - 600)::numeric / 400) * 100, 1)
      WHEN p_score < 1500  THEN ROUND(((p_score - 1000)::numeric / 500) * 100, 1)
      WHEN p_score < 2200  THEN ROUND(((p_score - 1500)::numeric / 700) * 100, 1)
      WHEN p_score < 3000  THEN ROUND(((p_score - 2200)::numeric / 800) * 100, 1)
      WHEN p_score < 4500  THEN ROUND(((p_score - 3000)::numeric / 1500) * 100, 1)
      WHEN p_score < 6500  THEN ROUND(((p_score - 4500)::numeric / 2000) * 100, 1)
      ELSE 100
    END AS percentage;
$$;

-- ============================================================
-- SECTION 18 — SCHEDULED JOBS (pg_cron)
-- Wrapped in exception handler for local dev (no pg_cron)
-- ============================================================

DO $$ BEGIN
  -- Daily jobs at midnight Puerto Rico time (4am UTC)
  PERFORM cron.schedule(
    'smartgym-daily-jobs',
    '0 4 * * *',
    $cron$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/scheduled-daily',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body   := '{}'::jsonb
    );
    $cron$
  );

  -- Weekly jobs — Sunday midnight UTC
  PERFORM cron.schedule(
    'smartgym-weekly-jobs',
    '0 0 * * 0',
    $cron$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/scheduled-weekly',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body   := '{}'::jsonb
    );
    $cron$
  );

  -- Hourly: deactivate failed push subscriptions
  PERFORM cron.schedule(
    'smartgym-cleanup-push-subscriptions',
    '0 * * * *',
    $cron$
    UPDATE push_subscriptions
    SET is_active = false
    WHERE failure_count >= 3
      AND last_failed_at < NOW() - INTERVAL '1 hour'
      AND is_active = true;
    $cron$
  );

  -- Daily at 4:30am UTC: clean old error logs (keep 90 days)
  PERFORM cron.schedule(
    'smartgym-clean-error-logs',
    '30 4 * * *',
    $cron$
    DELETE FROM error_log
    WHERE occurred_at < NOW() - INTERVAL '90 days';
    $cron$
  );

  -- Daily at 4:45am UTC: clean old API performance logs (keep 7 days)
  PERFORM cron.schedule(
    'smartgym-clean-api-performance-logs',
    '45 4 * * *',
    $cron$
    DELETE FROM api_performance_log
    WHERE occurred_at < NOW() - INTERVAL '7 days';
    $cron$
  );

  -- Daily at 3am UTC: compute platform metrics for yesterday
  PERFORM cron.schedule(
    'smartgym-compute-platform-metrics',
    '0 3 * * *',
    $cron$
    INSERT INTO platform_daily_metrics (
      date,
      total_gyms,
      total_active_gyms,
      total_members,
      total_sessions
    )
    SELECT
      CURRENT_DATE - 1,
      COUNT(DISTINCT g.id) FILTER (WHERE g.is_active = true),
      COUNT(DISTINCT g.id) FILTER (
        WHERE g.is_active = true
          AND g.subscription_status IN ('active','trial')
      ),
      COUNT(DISTINCT m.id) FILTER (WHERE m.is_active = true),
      COUNT(DISTINCT ws.id) FILTER (
        WHERE ws.session_date = CURRENT_DATE - 1
      )
    FROM gyms g
    LEFT JOIN members m ON m.gym_id = g.id
    LEFT JOIN workout_sessions ws ON ws.session_date = CURRENT_DATE - 1
    ON CONFLICT (date) DO UPDATE SET
      total_gyms        = EXCLUDED.total_gyms,
      total_active_gyms = EXCLUDED.total_active_gyms,
      total_members     = EXCLUDED.total_members,
      total_sessions    = EXCLUDED.total_sessions,
      computed_at       = now();
    $cron$
  );

  -- Daily at 5am UTC: expire old feed events (keep 90 days)
  PERFORM cron.schedule(
    'smartgym-clean-feed-events',
    '0 5 * * *',
    $cron$
    DELETE FROM gym_feed_events
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND is_pinned = false;
    $cron$
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — scheduled jobs skipped';
END $$;

-- ============================================================
-- TABLE COMMENTS
-- ============================================================

COMMENT ON TABLE gym_billing IS
'Gym owners pay for SmartGym subscriptions.
Members get access to all features their gym has paid for at no additional cost.
Member-direct billing is a future Phase 4+ feature for:
  (a) members whose gym does not use SmartGym (SmartGym Anywhere - $4.99/mo)
  (b) optional Pro feature upgrades at non-Pro gyms (SmartGym+ - $7.99/mo)
Members NEVER pay to access features their gym has already paid for.
The gym tier determines every member feature ceiling.';

COMMENT ON TABLE members IS
'A member record is created when a gym member first scans a QR code.
user_id is null until they complete OTP phone verification.
Members are always associated with exactly one gym.
Body metrics data is private to the member — never accessible to owners or trainers
unless the member has explicitly enabled share_weight_with_trainer in member_settings.';
