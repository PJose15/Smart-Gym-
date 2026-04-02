/**
 * Workout Mode Detection — determines if the user is in AI program,
 * trainer program, or freestyle mode, and loads today's program context.
 */
import { supabase } from './supabase';
import { getTodaysProgramDay } from '@nexera/utils';

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

export async function detectWorkoutMode(userId: string): Promise<ModeContext> {
  // Check for active program assignment
  const { data: assignment } = await supabase
    .from('member_program_assignments')
    .select('program_id, assigned_at, status')
    .eq('profile_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!assignment) {
    return { mode: 'freestyle' };
  }

  // Load program details
  const { data: program } = await supabase
    .from('programs')
    .select('id, name, trainer_id')
    .eq('id', assignment.program_id)
    .maybeSingle();

  if (!program) {
    return { mode: 'freestyle' };
  }

  const mode: WorkoutMode = program.trainer_id ? 'trainer-program' : 'ai-program';

  // Load trainer name if applicable
  let trainerName: string | undefined;
  if (program.trainer_id) {
    const { data: trainer } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', program.trainer_id)
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
