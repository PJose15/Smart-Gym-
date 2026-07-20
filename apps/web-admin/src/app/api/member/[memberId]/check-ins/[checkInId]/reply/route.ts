import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendNotification } from '@/lib/notifications/dispatcher';

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
    const uuidError = validateUUIDs({ memberId, checkInId });
    if (uuidError) return uuidError;
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

    const rl = checkRateLimit(`checkin-reply:${memberId}`, 5, 60_000);
    if (rl) return rl;

    // Atomic update: set reply only if not already replied (prevents TOCTOU race)
    const { data: updated, error: updateErr } = await admin
      .from('weekly_checkins')
      .update({
        member_replied: true,
        reply_text: replyText.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq('id', checkInId)
      .eq('member_id', memberId)
      .eq('member_replied', false)
      .select('id, trainer_id, gym_id')
      .single();

    if (updateErr || !updated) {
      // Distinguish 404 vs 409: check if the check-in exists at all
      const { data: exists } = await admin
        .from('weekly_checkins')
        .select('id, member_replied')
        .eq('id', checkInId)
        .eq('member_id', memberId)
        .single();

      if (!exists) {
        return NextResponse.json(
          { error: 'Check-in not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Already replied to this check-in' },
        { status: 409 }
      );
    }

    // If has trainer, notify them via dispatcher (no PII in push body)
    if (updated.trainer_id) {
      // Look up trainer's member record for notification targeting
      const { data: trainerMember } = await admin
        .from('members')
        .select('id')
        .eq('user_id', updated.trainer_id)
        .eq('gym_id', updated.gym_id)
        .maybeSingle();

      if (trainerMember) {
        sendNotification({
          gym_id: updated.gym_id,
          member_id: trainerMember.id,
          type: 'checkin_reply',
          title: 'Check-in reply',
          body: 'A member replied to their weekly check-in.',
          data: { check_in_id: checkInId },
        }).catch((err) => {
          console.error('[check-ins/reply] Notification dispatch failed:', err);
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
