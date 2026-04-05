import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { gymId: string; memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ gymId: params.gymId, memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const url = req.nextUrl.searchParams;
    const type = url.get('type') || 'volume';
    const period = url.get('period') || 'week';

    const { data, error } = await admin
      .from('member_leaderboard_positions')
      .select('rank, value')
      .eq('gym_id', params.gymId)
      .eq('member_id', params.memberId)
      .eq('leaderboard_type', type)
      .eq('period', period)
      .maybeSingle();

    // Total participants
    const { count } = await admin
      .from('member_leaderboard_positions')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', params.gymId)
      .eq('leaderboard_type', type)
      .eq('period', period);

    if (error) return NextResponse.json({ error: 'Failed to fetch rank' }, { status: 500 });
    return NextResponse.json({
      rank: data?.rank ?? null,
      value: data?.value ?? 0,
      total_participants: count ?? 0,
      type,
      period,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
