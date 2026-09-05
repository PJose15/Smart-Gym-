import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

/**
 * GET /api/trainer/members/[memberId]/program
 * Returns the member's active AI program + available gym programs for assignment.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, gym_id, user_id } = result;

    // Rate limit AFTER auth, keyed on the authenticated trainer (M-9).
    const rl = checkRateLimit(`trainer-prog:${user_id}`, 30, 60_000);
    if (rl) return rl;

    // Verify member belongs to this gym
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch active AI program
    const { data: program } = await admin
      .from('ai_programs')
      .select('id, title, description, goal, duration_weeks, sessions_per_week, week_number, day_number, sessions_completed, sessions_total, on_track, program_data, generated_by, trainer_approved, created_at')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch available trainer-created programs for assignment
    const { data: programs } = await admin
      .from('programs')
      .select('id, name, description, goal, duration_weeks, sessions_per_week')
      .eq('gym_id', gym_id)
      .eq('is_active', true)
      .order('name');

    return NextResponse.json({
      program: program ?? null,
      available_programs: programs ?? [],
    });
  } catch (err) {
    console.error('[trainer/members/program] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
