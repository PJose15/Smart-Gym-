import { NextRequest, NextResponse } from 'next/server';
import { pushSubscribeSchema } from '@/lib/validation/push';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/member/push/subscribe
 * Upserts a web push subscription for a member.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = pushSubscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, subscription, user_agent, platform } = parsed.data;

    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`push-subscribe:${member_id}`, 5, 60_000);
    if (rl) return rl;

    // Tenant binding: gym comes from the member row, never the body
    const gymId = await resolveMemberGym(admin, member_id);
    if (!gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Upsert by (member_id, endpoint) — matches UNIQUE constraint in schema
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          member_id,
          gym_id: gymId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: user_agent || null,
          platform: platform || 'desktop',
          is_active: true,
          subscribed_at: new Date().toISOString(),
        },
        { onConflict: 'member_id,endpoint' }
      );

    if (error) {
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
