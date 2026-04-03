import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/**
 * GET /api/member/[memberId]/program
 * Returns the member's active training program with full structure.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

    const rl = checkRateLimit(`program:${memberId}`, 30, 60_000);
    if (rl) return rl;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Fetch active program
    const { data: program, error } = await admin
      .from('ai_programs')
      .select('id, title, description, goal, duration_weeks, sessions_per_week, week_number, day_number, sessions_completed, sessions_total, on_track, program_data, generated_by, trainer_approved, trainer_approved_by, created_at')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
    }

    if (!program) {
      return NextResponse.json({ program: null });
    }

    // If trainer-approved, fetch trainer name
    let trainerName: string | null = null;
    if (program.trainer_approved_by) {
      const { data: trainer } = await admin
        .from('users')
        .select('display_name')
        .eq('id', program.trainer_approved_by)
        .maybeSingle();
      trainerName = trainer?.display_name ?? null;
    }

    return NextResponse.json({
      program: {
        id: program.id,
        title: program.title,
        description: program.description,
        goal: program.goal,
        duration_weeks: program.duration_weeks,
        sessions_per_week: program.sessions_per_week,
        week_number: program.week_number,
        day_number: program.day_number,
        sessions_completed: program.sessions_completed,
        sessions_total: program.sessions_total,
        on_track: program.on_track,
        program_data: program.program_data,
        generated_by: program.generated_by,
        trainer_approved: program.trainer_approved,
        trainer_name: trainerName,
        created_at: program.created_at,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
