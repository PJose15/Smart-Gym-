import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { trainerMessageSchema } from '@/lib/validation/staff';
import { checkRateLimit } from '@/lib/rateLimit';
import { assertInGym } from '@/lib/auth/tenant';
import type { ConversationPreview } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    // Fetch the most recent 1000 messages for this trainer and group them
    // by member in-memory to produce conversation previews. 1000 rows is
    // a hard cap that covers any realistic active-conversation set for a
    // single trainer; older messages (if any) still belong to conversations
    // that will already appear in this window because we sort desc by
    // sent_at. TODO: move to a DB-side RPC that returns one row per
    // conversation once the messaging view matures.
    const { data: messages } = await admin
      .from('trainer_member_messages')
      .select('member_id, message_text, sent_at, read_at, sender_type')
      .eq('trainer_id', user_id)
      .eq('gym_id', gym_id)
      .eq('is_deleted_by_trainer', false)
      .order('sent_at', { ascending: false })
      .limit(1000);

    if (!messages || messages.length === 0) {
      return NextResponse.json([]);
    }

    // Group by member_id, take latest message
    const memberMap = new Map<string, { last_message: string; last_sent_at: string; unread_count: number }>();
    messages.forEach((m) => {
      if (!memberMap.has(m.member_id)) {
        memberMap.set(m.member_id, {
          last_message: m.message_text,
          last_sent_at: m.sent_at,
          unread_count: 0,
        });
      }
      // Count unread from members
      if (m.sender_type === 'member' && !m.read_at) {
        const entry = memberMap.get(m.member_id)!;
        entry.unread_count++;
      }
    });

    // Get member info
    const memberIds = [...memberMap.keys()];
    const { data: members } = await admin
      .from('members')
      .select('id, display_name, avatar_url')
      .in('id', memberIds);

    const memberInfo = new Map((members ?? []).map((m) => [m.id, m]));

    const conversations: ConversationPreview[] = memberIds.map((mid) => {
      const info = memberInfo.get(mid);
      const conv = memberMap.get(mid)!;
      return {
        member_id: mid,
        member_name: info?.display_name ?? 'Unknown',
        avatar_url: info?.avatar_url ?? null,
        last_message: conv.last_message,
        last_sent_at: conv.last_sent_at,
        unread_count: conv.unread_count,
      };
    });

    // Sort by most recent
    conversations.sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime());

    return NextResponse.json(conversations);
  } catch (err) {
    console.error('[trainer/messages GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const body = await req.json();

    const parsed = trainerMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { member_id, message_text } = parsed.data;

    const rl = checkRateLimit(`trainer-message:${user_id}`, 30, 60_000);
    if (rl) return rl;

    // M-10: the target member must belong to the trainer's gym — a trainer
    // must not be able to message members of other gyms.
    const memberOk = await assertInGym(admin, 'members', member_id, gym_id);
    if (!memberOk) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const { data: msg, error } = await admin
      .from('trainer_member_messages')
      .insert({
        trainer_id: user_id,
        member_id,
        gym_id,
        sender_type: 'trainer',
        message_text,
      })
      .select()
      .single();

    if (error) {
      console.error('[trainer/messages POST] DB error:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json(msg, { status: 201 });
  } catch (err) {
    console.error('[trainer/messages POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
