import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id, user_id } = result;

    const rl = checkRateLimit(`push-send:${gym_id}`, 10, 60_000);
    if (rl) return rl;

    const { target, title, body: msgBody } = await req.json();
    if (!title || !msgBody)
      return NextResponse.json(
        { error: 'title and body required' },
        { status: 400 }
      );

    // Log notification
    const { error } = await admin.from('notifications').insert({
      gym_id,
      created_by: user_id,
      target_type: target?.member_id ? 'member' : 'gym',
      target_id: target?.member_id || gym_id,
      title,
      body: msgBody,
    });

    if (error)
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
