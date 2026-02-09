// ─── Identity ───────────────────────────────────────────

export type Role = 'owner' | 'trainer' | 'member';

export interface Gym {
  id: string;
  name: string;
  slug: string;
  address?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // matches auth.users.id
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GymMember {
  id: string;
  gym_id: string;
  profile_id: string;
  role: Role;
  joined_at: string;
}

// ─── Equipment ──────────────────────────────────────────

export interface Machine {
  id: string;
  gym_id: string;
  name: string;
  qr_slug: string;
  target_muscles: string[];
  setup_steps: string[];
  safety_cues: string[];
  image_url?: string;
  created_at: string;
  updated_at: string;
}

// ─── Training ───────────────────────────────────────────

export interface Program {
  id: string;
  gym_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  machine_id?: string;
  exercise_name: string;
  order_index: number;
  default_sets: number;
  default_reps: number;
}

export interface MemberProgramAssignment {
  id: string;
  gym_id: string;
  profile_id: string;
  program_id: string;
  assigned_by: string;
  assigned_at: string;
}

// ─── Logging ────────────────────────────────────────────

export interface Workout {
  id: string;
  gym_id: string;
  profile_id: string;
  started_at: string;
  finished_at?: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  machine_id?: string;
  exercise_name: string;
  order_index: number;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe?: number;
  logged_at: string;
}

// ─── Gamification ───────────────────────────────────────

export type PointsReason = 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';

export interface PointsLedgerEntry {
  id: string;
  gym_id: string;
  profile_id: string;
  points: number;
  reason: PointsReason;
  reference_id?: string;
  created_at: string;
}

// ─── API Response Types ─────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface MachineDetailResponse {
  machine: Machine;
  gym_name: string;
}
