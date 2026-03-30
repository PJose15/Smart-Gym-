import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';

export const dynamic = 'force-dynamic';

/**
 * POST /api/member/[memberId]/check-ins/[checkInId]/reply
 * Member replies to a check-in. One reply per check-in, cannot be edited.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; checkInId: string }> }
) {
  try {
    const { memberId, checkInId } = await params;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const body = await request.json();
    const replyText = body.reply_text as string | undefined;

    if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
      return NextResponse.json(
        { error: 'reply_text is required' },
        { status: 400 }
      );
    }

    if (replyText.length > 2000) {
      return NextResponse.json(
        { error: 'reply_text must be 2000 characters or fewer' },
        { status: 400 }
      );
    }

    // Verify check-in belongs to this member and hasn't been replied to
    const { data: checkIn } = await admin
      .from('weekly_checkins')
      .select('id, member_id, member_replied, trainer_id, gym_id')
      .eq('id', checkInId)
      .eq('member_id', memberId)
      .single();

    if (!checkIn) {
      return NextResponse.json(
        { error: 'Check-in not found' },
        { status: 404 }
      );
    }

    if (checkIn.member_replied) {
      return NextResponse.json(
        { error: 'Already replied to this check-in' },
        { status: 409 }
      );
    }

    // Save reply
    await admin
      .from('weekly_checkins')
      .update({
        member_replied: true,
        reply_text: replyText.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq('id', checkInId);

    // If has trainer, create notification for the trainer
    if (checkIn.trainer_id) {
      // Look up trainer's member record for notification
      const { data: trainerMember } = await admin
        .from('members')
        .select('id')
        .eq('user_id', checkIn.trainer_id)
        .eq('gym_id', checkIn.gym_id)
        .maybeSingle();

      if (trainerMember) {
        await admin.from('notifications').insert({
          member_id: trainerMember.id,
          gym_id: checkIn.gym_id,
          notification_type: 'coach_note',
          title: 'Member replied to check-in',
          body: replyText.trim().slice(0, 100),
          data: {
            check_in_id: checkInId,
            member_id: memberId,
          },
          channel: 'in-app',
          status: 'sent',
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[member/check-ins/reply] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
