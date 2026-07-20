import { NextResponse } from 'next/server';
import { safeKeyEquals } from '@/lib/internalAuth';
import { createClient } from '@supabase/supabase-js';
import { sendCheckInToMember } from '@/lib/checkIn/sendCheckIn';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/cron/checkin-deadline
 * Called Monday 6pm PR time (10pm UTC) — auto-sends any check-ins
 * where trainer hasn't reviewed within 48 hours.
 */
export async function POST(request: Request) {
  try {
    const internalKey = process.env.INTERNAL_WEBHOOK_KEY;
    if (!internalKey) {
      return NextResponse.json(
        { error: 'Internal webhook key not configured' },
        { status: 500 }
      );
    }

    const providedKey = request.headers.get('x-smartgym-internal-key');
    if (!safeKeyEquals(providedKey, internalKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Find check-ins that are pending trainer review and past the 48-hour deadline
    const fortyEightHoursAgo = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    ).toISOString();

    const { data: expired } = await admin
      .from('weekly_checkins')
      .select('id, member_id, gym_id, ai_draft')
      .eq('trainer_approved', false)
      .is('sent_at', null)
      .not('trainer_id', 'is', null)
      .lt('created_at', fortyEightHoursAgo);

    if (!expired || expired.length === 0) {
      return NextResponse.json({ auto_sent: 0 });
    }

    let autoSent = 0;

    for (const checkIn of expired) {
      try {
        // Set the AI draft as the final message (sendCheckInToMember handles sent_at + trainer_approved)
        await admin
          .from('weekly_checkins')
          .update({
            final_message: checkIn.ai_draft,
            sent_by: 'ai',
          })
          .eq('id', checkIn.id);

        await sendCheckInToMember(
          checkIn.id,
          checkIn.member_id,
          checkIn.gym_id,
          admin
        );

        autoSent++;
      } catch (error) {
        console.error(
          `[checkin-deadline] Error auto-sending ${checkIn.id}:`,
          error
        );
      }
    }

    return NextResponse.json({ auto_sent: autoSent });
  } catch (err) {
    console.error('[checkin-deadline] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
