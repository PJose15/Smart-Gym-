/**
 * Workout Mode Detection — determines if the user is in AI program,
 * trainer program, or freestyle mode, and loads today's program context.
 */
import { supabase } from './supabase';
import {
  getTodaysProgramDay,
  extractAiProgramDays as extractAiProgramDaysShared,
} from '@nexera/utils';
import { getMemberId } from './memberData';

export type WorkoutMode = 'ai-program' | 'trainer-program' | 'freestyle';

export interface ProgramExercise {
  id: string;
  exercise_name: string;
  default_sets: number;
  default_reps: number;
  machine_id: string | null;
  order_index: number;
}

export interface TodayDay {
  dayNumber: number;
  dayName: string;
  exercises: ProgramExercise[];
}

export interface ModeContext {
  mode: WorkoutMode;
  programId?: string;
  programTitle?: string;
  trainerName?: string;
  todayDay?: TodayDay;
  weekNumber?: number;
}

interface AiProgramDayJson {
  day_number?: number;
  name?: string;
  exercises?: Array<{
    exercise_name?: string;
    default_sets?: number;
    default_reps?: number;
    machine_id?: string | null;
  }>;
}

/**
 * Extracts the day rotation from an ai_programs.program_data JSON blob.
 * Delegates to the shared @nexera/utils implementation (canonical
 * `{ days: [...] }` with a `{ weeks: [{ days: [...] }] }` fallback);
 * re-exported here so existing mobile imports keep working.
 */
export function extractAiProgramDays(programData: unknown): AiProgramDayJson[] {
  return extractAiProgramDaysShared<AiProgramDayJson>(programData);
}

/** Loads mode context for an assignment that only carries an ai_program_id. */
async function detectAiProgramMode(aiProgramId: string, assignedAt: string): Promise<ModeContext> {
  const { data: aiProgram } = await supabase
    .from('ai_programs')
    .select('id, title, program_data')
    .eq('id', aiProgramId)
    .maybeSingle();

  if (!aiProgram) return { mode: 'freestyle' };

  const jsonDays = extractAiProgramDays(aiProgram.program_data);

  if (jsonDays.length === 0) {
    return {
      mode: 'ai-program',
      programId: aiProgram.id,
      programTitle: aiProgram.title ?? undefined,
    };
  }

  const todayDayNumber = getTodaysProgramDay(assignedAt, jsonDays.length);
  const todayIdx = jsonDays.findIndex((d, i) => (d.day_number ?? i + 1) === todayDayNumber);
  const today = jsonDays[todayIdx === -1 ? 0 : todayIdx];

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;

  return {
    mode: 'ai-program',
    programId: aiProgram.id,
    programTitle: aiProgram.title ?? undefined,
    todayDay: {
      dayNumber: todayDayNumber,
      dayName: today.name ?? `Day ${todayDayNumber}`,
      exercises: (today.exercises ?? []).map((ex, i) => ({
        id: `ex-${i}`,
        exercise_name: ex.exercise_name ?? 'Unknown',
        default_sets: ex.default_sets ?? 3,
        default_reps: ex.default_reps ?? 10,
        machine_id: ex.machine_id ?? null,
        order_index: i,
      })),
    },
    weekNumber,
  };
}

export async function detectWorkoutMode(userId: string): Promise<ModeContext> {
  // Resolve member_id from user_id
  const memberId = await getMemberId(userId);
  if (!memberId) return { mode: 'freestyle' };

  // Check for active program assignment
  const { data: assignment } = await supabase
    .from('member_program_assignments')
    .select('program_id, assigned_at, ai_program_id')
    .eq('member_id', memberId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!assignment) {
    return { mode: 'freestyle' };
  }

  // Assignment may carry EITHER program_id (trainer-built program) OR
  // ai_program_id (AI program stored as JSON in ai_programs.program_data).
  if (!assignment.program_id && assignment.ai_program_id) {
    return detectAiProgramMode(assignment.ai_program_id, assignment.assigned_at);
  }

  // Load program details
  const { data: program } = await supabase
    .from('programs')
    .select('id, name, created_by')
    .eq('id', assignment.program_id)
    .maybeSingle();

  if (!program) {
    return { mode: 'freestyle' };
  }

  // If no ai_program_id, it's a trainer-created program
  const mode: WorkoutMode = assignment.ai_program_id ? 'ai-program' : 'trainer-program';

  // Load trainer name if applicable
  let trainerName: string | undefined;
  if (program.created_by && !assignment.ai_program_id) {
    const { data: trainer } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', program.created_by)
      .maybeSingle();
    trainerName = trainer?.full_name ?? undefined;
  }

  // Load program days
  const { data: days } = await supabase
    .from('program_days')
    .select('id, day_number, name')
    .eq('program_id', program.id)
    .order('day_number');

  if (!days || days.length === 0) {
    return {
      mode,
      programId: program.id,
      programTitle: program.name,
      trainerName,
    };
  }

  // Determine today's day
  const todayDayNumber = getTodaysProgramDay(assignment.assigned_at, days.length);
  const todayDay = days.find((d) => d.day_number === todayDayNumber) || days[0];

  // Load exercises for today
  const { data: exercises } = await supabase
    .from('program_exercises')
    .select('id, exercise_name, default_sets, default_reps, machine_id, order_index')
    .eq('program_day_id', todayDay.id)
    .order('order_index');

  // Compute week number
  const daysSinceStart = Math.floor(
    (Date.now() - new Date(assignment.assigned_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;

  return {
    mode,
    programId: program.id,
    programTitle: program.name,
    trainerName,
    todayDay: {
      dayNumber: todayDayNumber,
      dayName: todayDay.name,
      exercises: (exercises ?? []) as ProgramExercise[],
    },
    weekNumber,
  };
}
