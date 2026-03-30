import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { updateWorkoutSharePost } from '@/lib/social/workoutShare';

export const dynamic = 'force-dynamic';

/** PATCH /api/member/[memberId]/workout-share/[eventId] — Update share with results */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; eventId: string }> }
) {
  try {
    const { memberId, eventId } = await params;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const body = await request.json();
    await updateWorkoutSharePost(eventId, memberId, body.session_results, admin);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[workout-share/update] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
