import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/[memberId]/check-ins
 * Returns latest check-in + history for a member.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Get the member's gym_id
    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Latest check-in (sent only)
    const { data: latest } = await admin
      .from('weekly_checkins')
      .select('*')
      .eq('member_id', memberId)
      .not('sent_at', 'is', null)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    // History (last 12 sent check-ins)
    const { data: history } = await admin
      .from('weekly_checkins')
      .select(
        'id, week_start, week_end, final_message, sent_by, sent_at, member_replied, reply_text, sessions_this_week, total_volume_lbs, prs_this_week, current_streak, trainer_id'
      )
      .eq('member_id', memberId)
      .not('sent_at', 'is', null)
      .order('week_start', { ascending: false })
      .limit(12);

    return NextResponse.json({
      latest,
      history: history ?? [],
    });
  } catch (err) {
    console.error('[member/check-ins] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
