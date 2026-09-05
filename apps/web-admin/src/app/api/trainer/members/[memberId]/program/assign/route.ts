import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import { sendNotification } from '@/lib/notifications/dispatcher';

/** Shape returned by Supabase join: program_days(*, program_exercises(*)) */
interface ProgramExerciseRow {
  exercise_name: string | null;
  machine_id: string | null;
  order_index: number | null;
  default_sets: number | null;
  default_reps: number | null;
}

interface ProgramDayRow {
  day_number: number | null;
  name: string | null;
  program_exercises: ProgramExerciseRow[];
}

/**
 * POST /api/trainer/members/[memberId]/program/assign
 * Assigns a trainer-created program to a member.
 * Body: { program_id: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;

    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    // Rate limit AFTER auth, keyed on the authenticated trainer (M-9).
    const rl = checkRateLimit(`trainer-assign:${user_id}`, 10, 60_000);
    if (rl) return rl;
    const { memberId } = params;

    const body = await request.json();
    const { program_id } = body;

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    // Verify member belongs to this gym
    const { data: member } = await admin
      .from('members')
      .select('id, experience_level')
      .eq('id', memberId)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch the trainer-created program with days and exercises
    const { data: trainerProgram } = await admin
      .from('programs')
      .select('id, name, description, goal, duration_weeks, sessions_per_week, program_days(*, program_exercises(*))')
      .eq('id', program_id)
      .eq('gym_id', gym_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!trainerProgram) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Validate program has valid numeric fields
    const durationWeeks = trainerProgram.duration_weeks;
    const sessionsPerWeek = trainerProgram.sessions_per_week;
    if (!durationWeeks || durationWeeks < 1 || !sessionsPerWeek || sessionsPerWeek < 1) {
      return NextResponse.json({ error: 'Program has invalid duration or session configuration' }, { status: 400 });
    }

    // Deactivate any existing active AI programs for this member
    const { error: deactivateError } = await admin
      .from('ai_programs')
      .update({ is_active: false })
      .eq('member_id', memberId)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('[trainer/program/assign] Deactivate error:', deactivateError);
      return NextResponse.json({ error: 'Failed to deactivate existing program' }, { status: 500 });
    }

    // Convert trainer program structure to program_data JSON
    const programDays = (trainerProgram.program_days ?? []) as ProgramDayRow[];
    const days = programDays
      .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
      .map((day) => ({
        day_number: day.day_number ?? 1,
        name: day.name ?? 'Untitled Day',
        exercises: (day.program_exercises ?? [])
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((ex) => ({
            exercise_name: ex.exercise_name ?? 'Unknown Exercise',
            machine_id: ex.machine_id ?? null,
            default_sets: ex.default_sets ?? 3,
            default_reps: ex.default_reps ?? 10,
          })),
      }));

    const sessionsTotal = durationWeeks * sessionsPerWeek;

    // Create new ai_programs record
    const { data: newProgram, error: insertError } = await admin
      .from('ai_programs')
      .insert({
        member_id: memberId,
        gym_id,
        experience_level: member.experience_level ?? 'beginner',
        title: trainerProgram.name,
        description: trainerProgram.description,
        goal: trainerProgram.goal,
        duration_weeks: trainerProgram.duration_weeks,
        sessions_per_week: trainerProgram.sessions_per_week,
        week_number: 1,
        day_number: 1,
        sessions_completed: 0,
        sessions_total: sessionsTotal,
        on_track: true,
        program_data: { days },
        generated_by: 'trainer',
        trainer_approved: true,
        trainer_approved_at: new Date().toISOString(),
        trainer_approved_by: user_id,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !newProgram) {
      console.error('[trainer/program/assign] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to assign program' }, { status: 500 });
    }

    // Insert into member_program_assignments
    await admin
      .from('member_program_assignments')
      .insert({
        member_id: memberId,
        program_id: trainerProgram.id,
        assigned_by: user_id,
        ai_program_id: newProgram.id,
      });

    // Notify member of new program assignment — fire-and-forget
    sendNotification({
      gym_id,
      member_id: memberId,
      type: 'program_assigned',
      title: 'New training program',
      body: 'Your trainer assigned you a new program.',
      data: { program_id: newProgram.id },
    }).catch((err: unknown) => {
      console.error('[trainer/program/assign] sendNotification error:', err);
    });

    return NextResponse.json({ success: true, program_id: newProgram.id });
  } catch (err) {
    console.error('[trainer/program/assign] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
