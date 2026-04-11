import { NextRequest, NextResponse } from 'next/server';
import { pushUnsubscribeSchema } from '@/lib/validation/push';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { member_id, endpoint } = parsed.data;

    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`push-unsubscribe:${member_id}`, 5, 60_000);
    if (rl) return rl;

    await admin
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('member_id', member_id)
      .eq('endpoint', endpoint);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
