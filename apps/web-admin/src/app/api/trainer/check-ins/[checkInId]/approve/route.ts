import { NextResponse, NextRequest } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { sendCheckInToMember } from '@/lib/checkIn/sendCheckIn';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trainer/check-ins/[checkInId]/approve
 * Trainer approves (optionally edits) and sends a check-in.
 * Body: { final_message?: string, wrote_own?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkInId: string }> }
) {
  try {
    const { checkInId } = await params;
    const uuidError = validateUUIDs({ checkInId });
    if (uuidError) return uuidError;
    const staffResult = await verifyStaff();
    if (staffResult instanceof NextResponse) return staffResult;
    const { user_id, admin } = staffResult;

    const body = await request.json();
    const finalMessage = body.final_message as string | undefined;
    const wroteOwn = body.wrote_own === true;

    const rl = checkRateLimit(`checkin-approve:${user_id}`, 20, 60_000);
    if (rl) return rl;

    // Verify this trainer owns this check-in
    const { data: checkIn } = await admin
      .from('weekly_checkins')
      .select('id, member_id, gym_id, trainer_id, ai_draft')
      .eq('id', checkInId)
      .eq('trainer_id', user_id)
      .single();

    if (!checkIn) {
      return NextResponse.json(
        { error: 'Check-in not found' },
        { status: 404 }
      );
    }

    const messageToSend = finalMessage?.trim() || checkIn.ai_draft;

    // Update check-in record
    await admin
      .from('weekly_checkins')
      .update({
        final_message: messageToSend,
        sent_by: wroteOwn ? 'trainer' : 'trainer_approved_ai',
        trainer_approved: true,
        trainer_approved_at: new Date().toISOString(),
      })
      .eq('id', checkInId);

    // Send to member
    await sendCheckInToMember(
      checkInId,
      checkIn.member_id,
      checkIn.gym_id,
      admin
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trainer/check-ins/approve] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
