import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { createWorkoutSharePost } from '@/lib/social/workoutShare';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** POST /api/member/[memberId]/workout-share — Create workout share post */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    // Rate limit: 5 shares per minute per member
    const rl = checkRateLimit(`workout-share:${memberId}`, 5, 60_000);
    if (rl) return rl;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const body = await request.json();
    const shareText = (body.share_text as string) || '';
    const programContext = body.program_context ?? null;

    if (shareText.length > 500) {
      return NextResponse.json({ error: 'share_text must be 500 characters or fewer' }, { status: 400 });
    }

    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const eventId = await createWorkoutSharePost(
      memberId, member.gym_id, shareText, programContext, admin
    );

    if (!eventId) {
      return NextResponse.json({ error: 'Already shared today' }, { status: 409 });
    }

    return NextResponse.json({ event_id: eventId });
  } catch (err) {
    console.error('[workout-share] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
