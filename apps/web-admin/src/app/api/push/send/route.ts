import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function POST(req: NextRequest) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id } = result;

    const rl = checkRateLimit(`push-send:${gym_id}`, 10, 60_000);
    if (rl) return rl;

    const { target, title, body: msgBody } = await req.json();
    if (!title || !msgBody)
      return NextResponse.json(
        { error: 'title and body required' },
        { status: 400 }
      );

    // Resolve target member(s). A single member (target.member_id) or a
    // gym-wide fan-out (no member_id) — the notifications table has one row
    // per recipient (member_id NOT NULL), so we expand to concrete members.
    const targetMemberId: string | undefined = target?.member_id;
    let memberIds: string[];

    if (targetMemberId) {
      const uuidError = validateUUIDs({ member_id: targetMemberId });
      if (uuidError) return uuidError;

      // Ensure the member belongs to this owner's gym.
      const { data: member, error: memberErr } = await admin
        .from('members')
        .select('id')
        .eq('id', targetMemberId)
        .eq('gym_id', gym_id)
        .maybeSingle();
      if (memberErr)
        return NextResponse.json(
          { error: 'Failed to resolve target member' },
          { status: 500 }
        );
      if (!member)
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      memberIds = [member.id];
    } else {
      // Gym-wide fan-out: every member of the gym.
      const { data: members, error: membersErr } = await admin
        .from('members')
        .select('id')
        .eq('gym_id', gym_id);
      if (membersErr)
        return NextResponse.json(
          { error: 'Failed to resolve gym members' },
          { status: 500 }
        );
      memberIds = (members ?? []).map((m: { id: string }) => m.id);
    }

    if (memberIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const rows = memberIds.map((member_id) => ({
      member_id,
      gym_id,
      notification_type: 'announcement',
      title,
      body: msgBody,
      channel: 'push',
      status: 'pending',
    }));

    const { error } = await admin.from('notifications').insert(rows);

    if (error)
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      );
    return NextResponse.json({ success: true, sent: rows.length });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
