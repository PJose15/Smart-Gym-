import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const { memberId } = params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    // Fetch full thread
    const { data: messages } = await admin
      .from('trainer_member_messages')
      .select('*')
      .eq('trainer_id', user_id)
      .eq('member_id', memberId)
      .eq('gym_id', gym_id)
      .eq('is_deleted_by_trainer', false)
      .order('sent_at', { ascending: true });

    // Mark unread member messages as read
    await admin
      .from('trainer_member_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('trainer_id', user_id)
      .eq('member_id', memberId)
      .eq('sender_type', 'member')
      .is('read_at', null);

    return NextResponse.json(messages ?? []);
  } catch (err) {
    console.error('[trainer/messages/[memberId] GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
