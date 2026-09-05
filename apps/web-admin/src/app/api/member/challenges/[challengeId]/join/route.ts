import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { challengeJoinSchema } from '@/lib/validation/challenge';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkFeatureAccess } from '@/lib/billing/featureGate';

interface RouteParams {
  params: Promise<{ challengeId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { challengeId } = await params;
    const uuidError = validateUUIDs({ challengeId });
    if (uuidError) return uuidError;
    const body = await request.json();
    const parsed = challengeJoinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id } = parsed.data;

    const auth = await verifyMember(member_id, request);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    const rl = checkRateLimit(`challenge-join:${member_id}`, 10, 60_000);
    if (rl) return rl;

    // Tenant binding (BE-H4): gym derived from the member row — the
    // caller-supplied body gym_id is ignored.
    const gym_id = await resolveMemberGym(admin, member_id);
    if (!gym_id) {
      return NextResponse.json({ error: 'Member does not belong to this gym' }, { status: 403 });
    }

    // Tier gate: joining challenges requires the challenges feature.
    // gym_id derived from the member's own record (verified above).
    const access = await checkFeatureAccess(gym_id, 'challenges');
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.upgradeMessage }, { status: 403 });
    }

    // Verify challenge exists and is active
    const { data: challenge } = await admin
      .from('gym_challenges')
      .select('id, title, is_active, entry_mode')
      .eq('id', challengeId)
      .eq('gym_id', gym_id)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (!challenge.is_active) {
      return NextResponse.json({ error: 'Challenge is no longer active' }, { status: 400 });
    }

    if (challenge.entry_mode === 'invite') {
      return NextResponse.json({ error: 'This challenge is invite-only' }, { status: 403 });
    }

    // Check if already joined
    const { data: existing } = await admin
      .from('challenge_participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('member_id', member_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already joined this challenge' }, { status: 409 });
    }

    // Get current participant count for initial rank
    const { count } = await admin
      .from('challenge_participants')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challengeId);

    const initialRank = (count || 0) + 1;

    // Join the challenge — catch UNIQUE violation from race condition
    const { error: joinErr } = await admin.from('challenge_participants').insert({
      challenge_id: challengeId,
      member_id,
      gym_id,
      current_rank: initialRank,
    });
    if (joinErr) {
      if (joinErr.code === '23505') {
        return NextResponse.json({ error: 'Already joined this challenge' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
    }

    // Generate feed event
    await admin.from('gym_feed_events').insert({
      gym_id,
      member_id,
      event_type: 'challenge_joined',
      display_text: `joined "${challenge.title}"`,
      context_data: { challenge_id: challengeId },
      priority: 'medium',
    });

    // Log milestone
    await admin.from('challenge_milestone_log').insert({
      challenge_id: challengeId,
      member_id,
      milestone_type: 'joined',
    });

    return NextResponse.json({ success: true, rank: initialRank }, { status: 201 });
  } catch (err) {
    console.error('[member/challenges/join] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
