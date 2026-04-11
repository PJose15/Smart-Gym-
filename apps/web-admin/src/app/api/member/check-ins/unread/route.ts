import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * GET /api/member/check-ins/unread?member_id=...
 * Returns { hasUnread, checkInId } for the most recent unread check-in.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('member_id');
    if (!memberId) {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 });
    }

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const { data } = await admin
      .from('weekly_checkins')
      .select('id')
      .eq('member_id', memberId)
      .not('sent_at', 'is', null)
      .is('read_at', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      hasUnread: !!data,
      checkInId: data?.id ?? null,
    });
  } catch (err) {
    console.error('[check-ins/unread GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/member/check-ins/unread
 * Body: { checkInId, memberId }
 * Sets read_at = now() on the matching check-in.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkInId, memberId } = body as { checkInId?: string; memberId?: string };

    if (!checkInId || !memberId) {
      return NextResponse.json({ error: 'checkInId and memberId required' }, { status: 400 });
    }

    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`checkin-read:${memberId}`, 30, 60_000);
    if (rl) return rl;

    await admin
      .from('weekly_checkins')
      .update({ read_at: new Date().toISOString() })
      .eq('id', checkInId)
      .eq('member_id', memberId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[check-ins/unread PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
