import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMostRecentMonday, toDateString, getWeekEnd } from '@/lib/checkIn/weekDateUtils';
import { generateAndStoreCheckIn } from '@/lib/checkIn/generateAndStoreCheckIn';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/agents/checkin-generate
 * Internal webhook — generates weekly check-ins for all active members at a gym.
 * Processes in batches of 10.
 */
export async function POST(request: Request) {
  try {
    // Auth: internal key only
    const internalKey = process.env.INTERNAL_WEBHOOK_KEY;
    if (!internalKey) {
      return NextResponse.json(
        { error: 'Internal webhook key not configured' },
        { status: 500 }
      );
    }

    const providedKey = request.headers.get('x-smartgym-internal-key');
    if (providedKey !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const gymId = body.gym_id as string | undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!gymId || !UUID_RE.test(gymId)) {
      return NextResponse.json(
        { error: 'Valid gym_id is required' },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Get all active members at this gym
    const { data: members } = await admin
      .from('members')
      .select('id, assigned_trainer_id')
      .eq('gym_id', gymId)
      .eq('status', 'active');

    if (!members || members.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0 });
    }

    const weekStart = getMostRecentMonday();
    const weekStartStr = toDateString(weekStart);

    let processed = 0;
    let failed = 0;

    // Process in batches of 10
    for (let i = 0; i < members.length; i += 10) {
      const batch = members.slice(i, i + 10);

      await Promise.allSettled(
        batch.map(async (member) => {
          try {
            // Check if check-in already generated this week
            const { data: existing } = await admin
              .from('weekly_checkins')
              .select('id')
              .eq('member_id', member.id)
              .eq('week_start', weekStartStr)
              .maybeSingle();

            if (existing) return; // already generated

            // Check member had at least 1 session this week
            const weekEnd = getWeekEnd(weekStart);
            const weekEndStr = toDateString(weekEnd);
            const { count } = await admin
              .from('workout_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('member_id', member.id)
              .not('completed_at', 'is', null)
              .gte('session_date', weekStartStr)
              .lte('session_date', weekEndStr);

            if (!count || count === 0) return; // no sessions this week

            await generateAndStoreCheckIn(
              member.id,
              gymId,
              weekStart,
              member.assigned_trainer_id ?? null,
              admin
            );

            processed++;
          } catch (error) {
            failed++;
            console.error(
              `[checkin-generate] Error for member ${member.id}:`,
              error
            );
          }
        })
      );
    }

    return NextResponse.json({ processed, failed });
  } catch (err) {
    console.error('[checkin-generate] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
