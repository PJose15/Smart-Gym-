import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const url = req.nextUrl.searchParams;
    const limit = Math.min(Number(url.get('limit')) || 20, 100);
    const offset = Number(url.get('offset')) || 0;
    const machine_id = url.get('machine_id');
    const date_from = url.get('date_from');
    const date_to = url.get('date_to');

    let query = admin
      .from('workout_sessions')
      .select(
        'id, gym_id, machine_id, member_id, session_date, workout_mode, sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps, is_personal_best, personal_best_type, pr_improvement_lbs, pr_improvement_pct, previous_best_lbs, ai_tip_shown, ai_tip_source, completed_at, created_at, updated_at'
      )
      .eq('member_id', params.memberId)
      .order('session_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (machine_id) query = query.eq('machine_id', machine_id);
    if (date_from) query = query.gte('session_date', date_from);
    if (date_to) query = query.lte('session_date', date_to);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    return NextResponse.json({ sessions: data ?? [], limit, offset });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
