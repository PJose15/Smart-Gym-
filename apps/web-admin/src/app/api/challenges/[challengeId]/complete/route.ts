import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { sendNotification } from '@/lib/notifications/dispatcher';

export async function POST(
  _req: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    const uuidError = validateUUIDs({ challengeId: params.challengeId });
    if (uuidError) return uuidError;
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, user_id, gym_id } = result;

    const rl = checkRateLimit(`challenge-complete:${user_id}`, 20, 60_000);
    if (rl) return rl;

    // Get challenge
    const { data: challenge } = await admin
      .from('gym_challenges')
      .select('id, gym_id, is_active')
      .eq('id', params.challengeId)
      .maybeSingle();
    if (!challenge || !challenge.is_active) {
      return NextResponse.json({ error: 'Challenge not found or already complete' }, { status: 404 });
    }
    // IDOR guard: challenge must belong to the caller's gym (404 to avoid leaking existence)
    if (challenge.gym_id !== gym_id) {
      return NextResponse.json({ error: 'Challenge not found or already complete' }, { status: 404 });
    }

    // Get winner (highest score)
    const { data: winner } = await admin
      .from('challenge_participants')
      .select('member_id, current_score')
      .eq('challenge_id', params.challengeId)
      .order('current_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Deactivate
    await admin
      .from('gym_challenges')
      .update({ is_active: false })
      .eq('id', params.challengeId);

    // Push: challenge_complete — notify all participants that the challenge has ended (fire-and-forget)
    // Dispatcher's 5-min (member, type) dedup absorbs overlap when cron auto-expiry (06-07) also fires
    {
      const { data: participants } = await admin
        .from('challenge_participants')
        .select('member_id')
        .eq('challenge_id', params.challengeId);

      if (participants && participants.length > 0) {
        for (const participant of participants) {
          sendNotification({
            gym_id: challenge.gym_id,
            member_id: participant.member_id,
            type: 'challenge_complete',
            title: 'Challenge finished',
            body: 'A challenge you joined has ended — see the final leaderboard',
            data: { challenge_id: params.challengeId },
          }).catch(err =>
            console.error('[challenge-complete] push failed:', err instanceof Error ? err.message : 'Unknown error')
          );
        }
      }
    }

    // Agent: challenge-ended — dedup_key = challengeId prevents double-fire if cron auto-expiry also runs (fire-and-forget)
    triggerUptimizeAIAgent('growth-agent', {
      event: 'challenge-ended',
      gym_id: challenge.gym_id,
      challenge_id: params.challengeId,
      dedup_key: params.challengeId,
      winner_member_id: winner?.member_id ?? null,
      is_agent_initiated: false,
    }).catch(err => console.error('[challenge-complete] challenge-ended agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));

    return NextResponse.json({ success: true, winner_id: winner?.member_id ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
