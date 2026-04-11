import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(
  _req: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    const uuidError = validateUUIDs({ challengeId: params.challengeId });
    if (uuidError) return uuidError;
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, user_id } = result;

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

    return NextResponse.json({ success: true, winner_id: winner?.member_id ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
