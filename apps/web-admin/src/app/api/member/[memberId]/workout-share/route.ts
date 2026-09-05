import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { createWorkoutSharePost } from '@/lib/social/workoutShare';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import { workoutShareBodySchema } from '@/lib/validation/feed';

export const dynamic = 'force-dynamic';

/** POST /api/member/[memberId]/workout-share — Create workout share post */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // M-9: rate limit after auth, keyed on the verified member.
    // 5 shares per minute per member.
    const rl = checkRateLimit(`workout-share:${memberId}`, 5, 60_000);
    if (rl) return rl;

    // M-5: bounded strings/numbers only — this lands in the gym feed.
    const body = await request.json();
    const parsed = workoutShareBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const { share_text: shareText, program_context: programContext } = parsed.data;

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
