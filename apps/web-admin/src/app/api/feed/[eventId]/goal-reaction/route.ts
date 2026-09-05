import { NextResponse, NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createMemberGoal } from '@/lib/social/memberGoals';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** POST /api/feed/[eventId]/goal-reaction — "Working on this too" reaction */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const uuidError = validateUUIDs({ eventId });
    if (uuidError) return uuidError;
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const memberId = body.member_id as string;
    if (!memberId) {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Verify the authenticated user owns this member_id (prevent IDOR)
    const { data: memberCheck } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('user_id', session.user.id)
      .eq('id', memberId)
      .maybeSingle();

    if (!memberCheck?.gym_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limit AFTER auth (M-9) — keyed on the verified member_id so an
    // attacker can't grief another member's limit with a spoofed id
    const rl = checkRateLimit(`goal-reaction:${memberId}`, 10, 60_000);
    if (rl) return rl;

    // Tenant binding (BE-H4): the event must belong to the member's gym
    // (404 — don't leak existence). Also verify it's a PR-type event.
    const { data: event } = await admin
      .from('gym_feed_events')
      .select('id, event_type, member_id, gym_id, context_data')
      .eq('id', eventId)
      .eq('gym_id', memberCheck.gym_id)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.event_type !== 'pr_weight' && event.event_type !== 'pr_volume') {
      return NextResponse.json({ error: 'Goal reactions only on PR events' }, { status: 400 });
    }

    // Create goalset reaction (ignore duplicate via unique constraint)
    const { error: reactionError } = await admin
      .from('feed_reactions')
      .insert({
        event_id: eventId,
        member_id: memberId,
        reaction_type: 'goalset',
      });

    if (reactionError && reactionError.code !== '23505') {
      throw reactionError;
    }

    // Create member goal inspired by this event
    const ctx = (event.context_data ?? {}) as Record<string, unknown>;
    const goalId = await createMemberGoal({
      memberId,
      gymId: event.gym_id,
      goalType: 'beat_pr',
      machineId: (ctx.machine_id as string) ?? null,
      machineName: (ctx.machine_name as string) ?? null,
      targetWeightLbs: (ctx.best_weight_lbs as number) ?? null,
      inspiredByMemberId: event.member_id,
      inspiredByEventId: eventId,
    }, admin);

    return NextResponse.json({ goal_id: goalId, reaction: 'goalset' });
  } catch (err) {
    console.error('[goal-reaction] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
