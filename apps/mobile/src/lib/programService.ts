/**
 * Program data layer — direct Supabase reads under RLS.
 *
 * Mirrors challengeService.ts structure.
 *
 * RLS ground truth:
 *  - ai_programs SELECT (own rows): programs_own policy —
 *    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
 *  - Migration 026 restored authenticated role table grants — direct mobile
 *    reads fully available.
 *
 * Anti-patterns to respect:
 *  - NEVER query program_days or program_exercises tables for member programs —
 *    AI programs store everything in ai_programs.program_data jsonb ({ days: [] }).
 *    The relational tables belong to trainer-template programs (different flow).
 *  - NEVER join member_program_assignments — the direct ai_programs query
 *    filtered by member_id + is_active = true is the ground-truth pattern
 *    (confirmed in home screen TodayZone and web-admin program route).
 */
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgramExercise {
  exercise_name: string;   // NOT name, NOT machine_name — confirmed from seed data
  machine_id: string | null;
  default_sets: number;
  default_reps: number;
}

export interface ProgramDay {
  day_number: number;
  name: string;
  exercises: ProgramExercise[];
}

export interface ActiveProgram {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  week_number: number;
  day_number: number;           // current day in rotation (1-indexed)
  sessions_completed: number;
  sessions_total: number;
  on_track: boolean | null;
  days: ProgramDay[];
  generated_by: string | null;
  trainer_approved: boolean;
  trainer_name: string | null;  // resolved from users.display_name when trainer_approved_by is set
  created_at: string;
}

// ─── Cache key helper ─────────────────────────────────────────────────────────

/** Cache key for a member's active program. Use with CacheTTL.programData. */
export function PROGRAM_CACHE_KEY(memberId: string): string {
  return `program:${memberId}`;
}

// ─── fetchProgram ─────────────────────────────────────────────────────────────

/**
 * Fetch the member's active program from ai_programs under RLS.
 *
 * Returns null (not a throw) when the member has no active ai_programs row —
 * handles the no-program-assigned state (PROG-04) gracefully.
 *
 * Trainer name is resolved via a second query to users.display_name only when
 * trainer_approved_by is set (AI-only programs skip this lookup entirely).
 *
 * program_data jsonb is parsed as { days?: ProgramDay[] } with ?? [] fallback
 * to handle null or malformed data without throwing.
 */
export async function fetchProgram(memberId: string): Promise<ActiveProgram | null> {
  const { data: program } = await supabase
    .from('ai_programs')
    .select(
      'id, title, description, goal, duration_weeks, sessions_per_week, week_number, day_number, sessions_completed, sessions_total, on_track, program_data, generated_by, trainer_approved, trainer_approved_by, created_at',
    )
    .eq('member_id', memberId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program) return null;

  // Resolve trainer name only when trainer_approved_by is set
  let trainerName: string | null = null;
  if (program.trainer_approved_by) {
    const { data: trainer } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', program.trainer_approved_by)
      .maybeSingle();
    trainerName = trainer?.display_name ?? null;
  }

  // Parse program_data jsonb — guard against null or missing days key
  const programData = program.program_data as { days?: ProgramDay[] } | null;
  const days: ProgramDay[] = programData?.days ?? [];

  return {
    id: program.id,
    title: program.title,
    description: program.description ?? null,
    goal: program.goal ?? null,
    duration_weeks: program.duration_weeks,
    sessions_per_week: program.sessions_per_week,
    week_number: program.week_number,
    day_number: program.day_number,
    sessions_completed: program.sessions_completed,
    sessions_total: program.sessions_total,
    on_track: program.on_track ?? null,
    days,
    generated_by: program.generated_by ?? null,
    trainer_approved: program.trainer_approved ?? false,
    trainer_name: trainerName,
    created_at: program.created_at,
  };
}
