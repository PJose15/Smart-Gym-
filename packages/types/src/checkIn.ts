// ============================================================================
// Phase 8.3 — Weekly Check-In Types (DOC_25)
// ============================================================================

export type CheckInSentBy = 'ai' | 'trainer' | 'trainer_approved_ai';

export interface PRDetail {
  machine_name: string;
  weight_lbs: number;
  improvement_lbs: number;
}

export interface CheckInWeekData {
  member_id: string;
  member_first_name: string;
  primary_goal: string;
  experience_level: string;
  months_as_member: number;
  program_title: string | null;
  program_week_number: number | null;
  week_start: string;
  week_end: string;
  sessions_this_week: number;
  sessions_scheduled: number | null;
  sessions_last_week: number;
  total_volume_lbs: number;
  volume_last_week: number;
  prs_this_week: number;
  prs_last_week: number;
  pr_details: PRDetail[];
  machines_trained: string[];
  avg_rpe: number | null;
  current_streak: number;
  avg_readiness_score: number | null;
  dominant_readiness_zone: string | null;
  most_trained_muscles: string[];
  undertrained_muscles: string[];
  push_pull_balance: number;
  dna_consistency: number | null;
  dna_progression: number | null;
  dna_balance: number | null;
  dna_trend: string | null;
  injuries_or_limitations: string | null;
  gym_language: 'en' | 'es';
  trainer_name: string | null;
  trainer_id: string | null;
}

export interface CheckInRecord {
  id: string;
  member_id: string;
  gym_id: string;
  trainer_id: string | null;
  week_start: string;
  week_end: string;
  ai_draft: string;
  final_message: string | null;
  sent_by: CheckInSentBy | null;
  trainer_approved: boolean;
  trainer_approved_at: string | null;
  sent_at: string | null;
  member_replied: boolean;
  reply_text: string | null;
  replied_at: string | null;
  sessions_this_week: number;
  sessions_last_week: number;
  total_volume_lbs: number;
  prs_this_week: number;
  current_streak: number;
  week_data_snapshot: CheckInWeekData;
  created_at: string;
  updated_at: string;
}
