// ============================================================================
// Equipment Types
// ============================================================================

export interface Machine {
  id: string;
  gym_id: string;
  name: string;
  qr_slug: string;
  target_muscles: string[];
  setup_steps: string[];
  safety_cues: string[];
  image_url: string | null;
  created_at: string;
}

// ============================================================================
// Identity Types
// ============================================================================

export interface Gym {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export type UserRole = 'owner' | 'trainer' | 'member';

export interface GymMember {
  id: string;
  gym_id: string;
  profile_id: string;
  role: UserRole;
  joined_at: string;
}

// ============================================================================
// Training / Program Types
// ============================================================================

export interface Program {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  day_number: number;
  name: string;
}

export interface ProgramExercise {
  id: string;
  program_day_id: string;
  machine_id: string | null;
  exercise_name: string;
  order_index: number;
  default_sets: number;
  default_reps: number;
}

// ============================================================================
// Logging Types
// ============================================================================

export interface Workout {
  id: string;
  gym_id: string;
  profile_id: string;
  started_at: string;
  finished_at: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  machine_id: string | null;
  exercise_name: string;
  order_index: number;
}

export interface Set {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  logged_at: string;
}

// ============================================================================
// Gamification Types
// ============================================================================

export type PointsReason = 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';

export interface PointsLedger {
  id: string;
  gym_id: string;
  profile_id: string;
  points: number;
  reason: PointsReason;
  reference_id: string | null;
  created_at: string;
}

// ============================================================================
// Dashboard / UI Types
// ============================================================================

export interface DashboardStat {
  title: string;
  value: string | number;
  change?: number; // Percentage change (e.g., 12 for +12%)
  trend?: 'up' | 'down' | 'neutral'; // Trend direction
}
