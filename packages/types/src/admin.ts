// ============================================================================
// Phase 9 — Super Admin Types
// ============================================================================

export interface AdminSession {
  user_id: string;
  email: string;
  display_name: string;
  platform_role: 'super_admin';
}

export interface PlatformFeatureFlag {
  id: string;
  flag_key: string;
  is_enabled: boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface PlatformDailyMetrics {
  id: string;
  date: string;
  total_gyms: number;
  total_active_gyms: number;
  total_members: number;
  total_sessions: number;
  new_gyms: number;
  churned_gyms: number;
  ai_tips_generated: number;
  ai_programs_generated: number;
  openai_cost_usd: number;
  mrr_usd: number;
  computed_at: string;
}

export interface PlatformOverviewData {
  active_gyms: number;
  total_members: number;
  sessions_today: number;
  mrr_usd: number;
  openai_cost_30d: number;
  new_registrations_7d: number;
  health_status: 'healthy' | 'degraded' | 'down';
}

/** The 7 platform-level feature flags from DOC_17 */
export const PLATFORM_FLAG_KEYS = [
  'ai_chat_enabled',
  'social_feed_enabled',
  'ai_program_generation',
  'global_leaderboard',
  'push_notifications_enabled',
  'uptimizeai_agents_enabled',
  'new_gym_registrations',
] as const;

export type PlatformFlagKey = (typeof PLATFORM_FLAG_KEYS)[number];

/** Flags that require confirmation before disabling */
export const CRITICAL_FLAGS: PlatformFlagKey[] = ['uptimizeai_agents_enabled'];
