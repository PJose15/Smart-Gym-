import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { feedReactSchema } from '@/lib/validation/feed';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendNotification } from '@/lib/notifications/dispatcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = feedReactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, event_id, reaction_type } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Rate limit AFTER auth (M-9) — keyed on the verified member_id so an
    // attacker can't grief another member's limit with a spoofed id
    const rl = checkRateLimit(`feed-react:${member_id}`, 30, 60_000);
    if (rl) return rl;

    // Tenant binding (BE-H4): the feed event must belong to the member's gym
    const gymId = await resolveMemberGym(admin, member_id);
    if (!gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: feedEvent } = await admin
      .from('gym_feed_events')
      .select('id, member_id, gym_id')
      .eq('id', event_id)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (!feedEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if reaction already exists (toggle behavior)
    const { data: existing, error: lookupErr } = await admin
      .from('feed_reactions')
      .select('id')
      .eq('event_id', event_id)
      .eq('member_id', member_id)
      .eq('reaction_type', reaction_type)
      .maybeSingle();

    if (lookupErr) {
      return NextResponse.json({ error: 'Failed to check reaction' }, { status: 500 });
    }

    if (existing) {
      // Remove reaction
      const { error: deleteErr } = await admin.from('feed_reactions').delete().eq('id', existing.id);
      if (deleteErr) {
        return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 });
      }
      return NextResponse.json({ toggled: false, reaction_type });
    } else {
      // Add reaction — catch UNIQUE violation from double-tap race condition
      const { error: insertErr } = await admin.from('feed_reactions').insert({
        event_id,
        member_id,
        reaction_type,
      });
      if (insertErr) {
        // UNIQUE violation (code 23505) means reaction already exists — treat as already toggled
        if (insertErr.code === '23505') {
          return NextResponse.json({ toggled: true, reaction_type });
        }
        return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 });
      }

      // Notify event owner of new reaction (skip self-reactions) — event row
      // already fetched (gym-scoped) above
      if (feedEvent.member_id && feedEvent.member_id !== member_id) {
        sendNotification({
          gym_id: feedEvent.gym_id,
          member_id: feedEvent.member_id,
          type: 'feed_reaction',
          title: 'New reaction',
          body: 'Someone reacted to your activity.',
          data: { event_id },
        }).catch((err: unknown) => {
          console.error('[feed/react] sendNotification error:', err);
        });
      }

      return NextResponse.json({ toggled: true, reaction_type });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
