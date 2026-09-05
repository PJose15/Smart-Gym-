import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAiProgramDays } from '@nexera/utils';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ProgramDay {
  day_number: number;
  name: string;
  exercises: Array<{
    exercise_name: string;
    machine_id: string | null;
    default_sets: number;
    default_reps: number;
  }>;
}

/**
 * GET /api/programs/active?member_id=X&machine_id=Y
 * Returns the active program context for a member, including
 * whether the current machine is in today's plan.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const memberId = searchParams.get('member_id');
  const machineId = searchParams.get('machine_id');

  if (!memberId) {
    return NextResponse.json(null);
  }

  const admin = getAdminClient();

  // Verify caller owns this member
  const { data: memberCheck } = await admin
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!memberCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch active program
  const { data: program } = await admin
    .from('ai_programs')
    .select('id, title, program_data, week_number, day_number, sessions_completed, sessions_total, sessions_per_week')
    .eq('member_id', memberId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program) {
    return NextResponse.json(null);
  }

  // Determine today's target day in the program rotation
  const todayDayIndex = ((program.day_number - 1) % program.sessions_per_week);
  // Handles both { days } and { weeks: [{ days }] } shaped program_data.
  const days = extractAiProgramDays<ProgramDay>(program.program_data);
  const todayPlan = days[todayDayIndex] ?? null;

  // Check if the scanned machine is in today's plan
  let machineInPlan = false;
  let targetExercise: { exercise_name: string; default_sets: number; default_reps: number } | null = null;

  if (todayPlan && machineId) {
    const match = todayPlan.exercises.find((e) => e.machine_id === machineId);
    if (match) {
      machineInPlan = true;
      targetExercise = {
        exercise_name: match.exercise_name,
        default_sets: match.default_sets,
        default_reps: match.default_reps,
      };
    }
  }

  return NextResponse.json({
    program_id: program.id,
    title: program.title,
    week_number: program.week_number,
    day_number: program.day_number,
    sessions_completed: program.sessions_completed,
    sessions_total: program.sessions_total,
    today_plan: todayPlan
      ? { day_name: todayPlan.name, exercise_count: todayPlan.exercises.length }
      : null,
    machine_in_plan: machineInPlan,
    target_exercise: targetExercise,
  });
}
