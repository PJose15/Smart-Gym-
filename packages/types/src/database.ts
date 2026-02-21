/**
 * Supabase Database type definitions.
 * Used with createClient<Database>() for typed queries.
 */

export interface Database {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          address?: string | null;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          logo_url?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
        };
      };
      gym_members: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          role: 'owner' | 'trainer' | 'member';
          joined_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          role: 'owner' | 'trainer' | 'member';
          joined_at?: string;
        };
        Update: {
          role?: 'owner' | 'trainer' | 'member';
        };
      };
      machines: {
        Row: {
          id: string;
          gym_id: string;
          name: string;
          qr_slug: string;
          target_muscles: string[];
          setup_steps: string[];
          safety_cues: string[];
          image_url: string | null;
          common_mistakes: string[];
          cue_version: number;
          cue_source: string;
          movement_pattern: string | null;
          equipment_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          name: string;
          qr_slug: string;
          target_muscles?: string[];
          setup_steps?: string[];
          safety_cues?: string[];
          image_url?: string | null;
          common_mistakes?: string[];
          cue_version?: number;
          cue_source?: string;
          movement_pattern?: string | null;
          equipment_type?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          qr_slug?: string;
          target_muscles?: string[];
          setup_steps?: string[];
          safety_cues?: string[];
          image_url?: string | null;
          common_mistakes?: string[];
          cue_version?: number;
          cue_source?: string;
          movement_pattern?: string | null;
          equipment_type?: string | null;
        };
      };
      programs: {
        Row: {
          id: string;
          gym_id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
      };
      program_days: {
        Row: {
          id: string;
          program_id: string;
          day_number: number;
          name: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          day_number: number;
          name: string;
        };
        Update: {
          day_number?: number;
          name?: string;
        };
      };
      program_exercises: {
        Row: {
          id: string;
          program_day_id: string;
          machine_id: string | null;
          exercise_name: string;
          order_index: number;
          default_sets: number;
          default_reps: number;
        };
        Insert: {
          id?: string;
          program_day_id: string;
          machine_id?: string | null;
          exercise_name: string;
          order_index: number;
          default_sets?: number;
          default_reps?: number;
        };
        Update: {
          machine_id?: string | null;
          exercise_name?: string;
          order_index?: number;
          default_sets?: number;
          default_reps?: number;
        };
      };
      member_program_assignments: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          program_id: string;
          assigned_by: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          program_id: string;
          assigned_by: string;
          assigned_at?: string;
        };
        Update: {
          program_id?: string;
          assigned_by?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          status: 'in_progress' | 'completed' | 'cancelled';
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          status?: 'in_progress' | 'completed' | 'cancelled';
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          status?: 'in_progress' | 'completed' | 'cancelled';
          finished_at?: string | null;
        };
      };
      workout_exercises: {
        Row: {
          id: string;
          workout_id: string;
          machine_id: string | null;
          exercise_name: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          workout_id: string;
          machine_id?: string | null;
          exercise_name: string;
          order_index: number;
        };
        Update: {
          machine_id?: string | null;
          exercise_name?: string;
          order_index?: number;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg: number;
          rpe: number | null;
          notes: string | null;
          logged_at: string;
        };
        Insert: {
          id?: string;
          workout_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg: number;
          rpe?: number | null;
          notes?: string | null;
          logged_at?: string;
        };
        Update: {
          set_number?: number;
          reps?: number;
          weight_kg?: number;
          rpe?: number | null;
          notes?: string | null;
        };
      };
      points_ledger: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          points: number;
          reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          points: number;
          reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          points?: number;
          reason?: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';
          reference_id?: string | null;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          gym_id: string | null;
          profile_id: string | null;
          key: string;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id?: string | null;
          profile_id?: string | null;
          key: string;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          key?: string;
          enabled?: boolean;
        };
      };
      app_events: {
        Row: {
          id: string;
          gym_id: string | null;
          profile_id: string | null;
          event_name: string;
          event_props: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id?: string | null;
          profile_id?: string | null;
          event_name: string;
          event_props?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          event_name?: string;
          event_props?: Record<string, unknown> | null;
        };
      };
      ai_audit_log: {
        Row: {
          id: string;
          gym_id: string | null;
          profile_id: string | null;
          context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation';
          inputs: Record<string, unknown>;
          outputs: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id?: string | null;
          profile_id?: string | null;
          context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation';
          inputs: Record<string, unknown>;
          outputs: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          context?: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation';
          inputs?: Record<string, unknown>;
          outputs?: Record<string, unknown>;
        };
      };
      user_training_profiles: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          goal: 'strength' | 'hypertrophy' | 'endurance' | 'general';
          experience: 'beginner' | 'intermediate' | 'advanced';
          units: 'kg' | 'lbs';
          preferred_rep_min: number | null;
          preferred_rep_max: number | null;
          limitations: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          goal?: 'strength' | 'hypertrophy' | 'endurance' | 'general';
          experience?: 'beginner' | 'intermediate' | 'advanced';
          units?: 'kg' | 'lbs';
          preferred_rep_min?: number | null;
          preferred_rep_max?: number | null;
          limitations?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          goal?: 'strength' | 'hypertrophy' | 'endurance' | 'general';
          experience?: 'beginner' | 'intermediate' | 'advanced';
          units?: 'kg' | 'lbs';
          preferred_rep_min?: number | null;
          preferred_rep_max?: number | null;
          limitations?: string[];
        };
      };
    };
    Functions: {
      get_machine_by_slug: {
        Args: { slug_param: string };
        Returns: {
          id: string;
          gym_id: string;
          name: string;
          qr_slug: string;
          target_muscles: string[];
          setup_steps: string[];
          safety_cues: string[];
          image_url: string | null;
          common_mistakes: string[];
          cue_version: number;
          cue_source: string;
          movement_pattern: string | null;
          equipment_type: string | null;
          created_at: string;
        }[];
      };
      get_my_gym_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: {
      workout_status: 'in_progress' | 'completed' | 'cancelled';
      user_role: 'owner' | 'trainer' | 'member';
      points_reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';
    };
  };
}
