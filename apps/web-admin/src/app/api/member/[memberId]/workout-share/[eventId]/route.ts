import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { updateWorkoutSharePost } from '@/lib/social/workoutShare';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { workoutShareResultsSchema } from '@/lib/validation/feed';

export const dynamic = 'force-dynamic';

/** PATCH /api/member/[memberId]/workout-share/[eventId] — Update share with results */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; eventId: string }> }
) {
  try {
    const { memberId, eventId } = await params;
    const uuidError = validateUUIDs({ memberId, eventId });
    if (uuidError) return uuidError;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`workout-share-update:${memberId}`, 10, 60_000);
    if (rl) return rl;

    // M-5: session_results is stored in gym_feed_events.context_data and
    // rendered in the feed — bounded strings/numbers only, reject extras.
    const body = await request.json();
    const parsed = workoutShareResultsSchema.safeParse(body?.session_results);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid session_results' },
        { status: 400 }
      );
    }

    await updateWorkoutSharePost(eventId, memberId, parsed.data, admin);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[workout-share/update] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
