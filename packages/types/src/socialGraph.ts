// ============================================================================
// Phase 8.4 — Social Graph Types (DOC_26)
// ============================================================================

export type GoalType = 'beat_pr' | 'reach_weight' | 'hit_sessions' | 'custom';

export interface MemberGoal {
  id: string;
  member_id: string;
  gym_id: string;
  goal_type: GoalType;
  machine_id: string | null;
  machine_name: string | null;
  target_weight_lbs: number | null;
  target_reps: number | null;
  target_sessions: number | null;
  custom_description: string | null;
  inspired_by_member_id: string | null;
  inspired_by_event_id: string | null;
  is_achieved: boolean;
  achieved_at: string | null;
  created_at: string;
}

export interface MachineLeaderboardEntry {
  rank: number;
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  best_weight_lbs: number;
  achieved_at: string;
  is_current_member: boolean;
}

export type WorkoutShareStatus = 'training' | 'completed';

export interface WorkoutShareContext {
  share_status: WorkoutShareStatus;
  program_week: number | null;
  program_day: number | null;
  program_focus: string | null;
  sessions_completed_today: number;
  prs_hit: number;
  volume_lbs: number;
  machines_used: string[];
  completed_at?: string;
}

export interface WorkoutShareResults {
  sessionsToday: number;
  prsHit: number;
  totalVolume: number;
  machinesUsed: string[];
}
