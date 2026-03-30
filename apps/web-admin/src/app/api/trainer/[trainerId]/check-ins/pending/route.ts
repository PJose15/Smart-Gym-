import { NextResponse, NextRequest } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trainer/[trainerId]/check-ins/pending
 * Returns all check-ins awaiting trainer review + recent sent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  try {
    const { trainerId } = await params;
    const staffResult = await verifyStaff();
    if (staffResult instanceof NextResponse) return staffResult;
    const { user_id, admin } = staffResult;

    // Trainer can only see their own check-ins
    if (user_id !== trainerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pending check-ins (not yet approved/sent)
    const { data: pending } = await admin
      .from('weekly_checkins')
      .select(
        '*, members(display_name, avatar_url)'
      )
      .eq('trainer_id', trainerId)
      .eq('trainer_approved', false)
      .is('sent_at', null)
      .order('created_at', { ascending: false });

    // Recently sent (last 20)
    const { data: sent } = await admin
      .from('weekly_checkins')
      .select(
        'id, week_start, week_end, final_message, sent_by, sent_at, member_replied, reply_text, sessions_this_week, prs_this_week, member_id, members(display_name, avatar_url)'
      )
      .eq('trainer_id', trainerId)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      pending: pending ?? [],
      sent: sent ?? [],
    });
  } catch (err) {
    console.error('[trainer/check-ins/pending] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
