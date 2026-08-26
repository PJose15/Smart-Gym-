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
          muscle_groups: string[];
          target_muscles: string[];
          setup_steps: string[];
          safety_cues: string[];
          image_url: string | null;
          common_mistakes: string[];
          cue_version: number;
          cue_source: string;
          movement_pattern: string;
          equipment_type: string;
          difficulty: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          tags: string[] | null;
          form_checklist_before: string[] | null;
          form_checklist_during: string[] | null;
          form_checklist_after: string[] | null;
          checklist_version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          name: string;
          qr_slug: string;
          muscle_groups?: string[];
          target_muscles?: string[];
          setup_steps?: string[];
          safety_cues?: string[];
          image_url?: string | null;
          common_mistakes?: string[];
          cue_version?: number;
          cue_source?: string;
          movement_pattern?: string;
          equipment_type?: string;
          difficulty?: string;
          primary_muscles?: string[];
          secondary_muscles?: string[];
          tags?: string[] | null;
          form_checklist_before?: string[] | null;
          form_checklist_during?: string[] | null;
          form_checklist_after?: string[] | null;
          checklist_version?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          qr_slug?: string;
          muscle_groups?: string[];
          target_muscles?: string[];
          setup_steps?: string[];
          safety_cues?: string[];
          image_url?: string | null;
          common_mistakes?: string[];
          cue_version?: number;
          cue_source?: string;
          movement_pattern?: string;
          equipment_type?: string;
          difficulty?: string;
          primary_muscles?: string[];
          secondary_muscles?: string[];
          tags?: string[] | null;
          form_checklist_before?: string[] | null;
          form_checklist_during?: string[] | null;
          form_checklist_after?: string[] | null;
          checklist_version?: number;
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
          reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'badge_unlocked' | 'manual';
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          points: number;
          reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'badge_unlocked' | 'manual';
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          points?: number;
          reason?: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'badge_unlocked' | 'manual';
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
          context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation' | 'alternatives' | 'guardrails' | 'coach_draft' | 'safety_nudge' | 'checklist' | 'coaching' | 'program_gen';
          inputs: Record<string, unknown>;
          outputs: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id?: string | null;
          profile_id?: string | null;
          context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation' | 'alternatives' | 'guardrails' | 'coach_draft' | 'safety_nudge' | 'checklist' | 'coaching' | 'program_gen';
          inputs: Record<string, unknown>;
          outputs: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          context?: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation' | 'alternatives' | 'guardrails' | 'coach_draft' | 'safety_nudge' | 'checklist' | 'coaching' | 'program_gen';
          inputs?: Record<string, unknown>;
          outputs?: Record<string, unknown>;
        };
      };
      set_feedback: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          workout_id: string;
          workout_exercise_id: string;
          set_id: string;
          feedback: 'ok' | 'unstable' | 'discomfort';
          body_area: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          workout_id: string;
          workout_exercise_id: string;
          set_id: string;
          feedback: 'ok' | 'unstable' | 'discomfort';
          body_area?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          feedback?: 'ok' | 'unstable' | 'discomfort';
          body_area?: string | null;
          notes?: string | null;
        };
      };
      ai_guardrail_insights: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          insight_type: string;
          severity: string;
          confidence: number;
          message: string;
          recommended_action: string;
          meta: Record<string, unknown> | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          insight_type: string;
          severity: string;
          confidence: number;
          message: string;
          recommended_action: string;
          meta?: Record<string, unknown> | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          severity?: string;
          message?: string;
          recommended_action?: string;
          meta?: Record<string, unknown> | null;
          expires_at?: string | null;
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
      trainer_assignments: {
        Row: {
          id: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          status: 'active' | 'paused';
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          status?: 'active' | 'paused';
          created_at?: string;
        };
        Update: {
          status?: 'active' | 'paused';
        };
      };
      coach_notes: {
        Row: {
          id: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          source: 'workout' | 'weekly' | 'manual';
          status: 'draft' | 'sent' | 'archived';
          title: string;
          body: string;
          meta: Record<string, unknown> | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          source: 'workout' | 'weekly' | 'manual';
          status?: 'draft' | 'sent' | 'archived';
          title: string;
          body: string;
          meta?: Record<string, unknown> | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          status?: 'draft' | 'sent' | 'archived';
          title?: string;
          body?: string;
          meta?: Record<string, unknown> | null;
          sent_at?: string | null;
        };
      };
      coach_note_drafts: {
        Row: {
          id: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          workout_id: string | null;
          period_start: string | null;
          period_end: string | null;
          draft_title: string;
          draft_body: string;
          confidence: number;
          signals: Record<string, unknown> | null;
          status: 'pending' | 'approved' | 'sent' | 'discarded';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          trainer_profile_id: string;
          member_profile_id: string;
          workout_id?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          draft_title: string;
          draft_body: string;
          confidence?: number;
          signals?: Record<string, unknown> | null;
          status?: 'pending' | 'approved' | 'sent' | 'discarded';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          draft_title?: string;
          draft_body?: string;
          confidence?: number;
          signals?: Record<string, unknown> | null;
          status?: 'pending' | 'approved' | 'sent' | 'discarded';
        };
      };
      coach_note_actions: {
        Row: {
          id: string;
          gym_id: string;
          draft_id: string | null;
          note_id: string | null;
          actor_profile_id: string;
          action: 'generated' | 'edited' | 'approved' | 'sent' | 'discarded';
          meta: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          draft_id?: string | null;
          note_id?: string | null;
          actor_profile_id: string;
          action: 'generated' | 'edited' | 'approved' | 'sent' | 'discarded';
          meta?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          action?: 'generated' | 'edited' | 'approved' | 'sent' | 'discarded';
          meta?: Record<string, unknown> | null;
        };
      };
      guardrail_acknowledgements: {
        Row: {
          id: string;
          gym_id: string;
          profile_id: string;
          insight_type: 'volume_spike' | 'high_rpe' | 'rep_collapse' | 'recovery_overlap';
          severity: 'low' | 'medium' | 'high';
          acknowledged_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          profile_id: string;
          insight_type: 'volume_spike' | 'high_rpe' | 'rep_collapse' | 'recovery_overlap';
          severity: 'low' | 'medium' | 'high';
          acknowledged_at?: string;
        };
        Update: {
          severity?: 'low' | 'medium' | 'high';
        };
      };
      trainer_style_settings: {
        Row: {
          id: string;
          gym_id: string;
          trainer_profile_id: string;
          tone: 'strict' | 'supportive' | 'neutral';
          verbosity: 'short' | 'standard' | 'detailed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          trainer_profile_id: string;
          tone?: 'strict' | 'supportive' | 'neutral';
          verbosity?: 'short' | 'standard' | 'detailed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tone?: 'strict' | 'supportive' | 'neutral';
          verbosity?: 'short' | 'standard' | 'detailed';
        };
      };
      member_note_ack: {
        Row: {
          id: string;
          note_id: string;
          profile_id: string;
          acknowledged_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          profile_id: string;
          acknowledged_at?: string;
        };
        Update: Record<string, never>;
      };
      social_connections: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
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
          movement_pattern: string;
          equipment_type: string;
          difficulty: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          tags: string[] | null;
          form_checklist_before: string[] | null;
          form_checklist_during: string[] | null;
          form_checklist_after: string[] | null;
          checklist_version: number;
          created_at: string;
        }[];
      };
      get_my_gym_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      upsert_own_profile: {
        Args: { p_full_name?: string; p_avatar_url?: string };
        Returns: undefined;
      };
      set_own_onboarding_status: {
        Args: { p_gym_id: string; p_status: string };
        Returns: undefined;
      };
    };
    Enums: {
      workout_status: 'in_progress' | 'completed' | 'cancelled';
      user_role: 'owner' | 'trainer' | 'member';
      points_reason: 'workout_completed' | 'set_logged' | 'streak_bonus' | 'badge_unlocked' | 'manual';
    };
  };
}
