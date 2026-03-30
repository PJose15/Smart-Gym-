import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { z } from 'zod';

const deleteSchema = z.object({
  member_id: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ commentId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { commentId } = await params;
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Verify comment belongs to member
    const { data: comment } = await admin
      .from('feed_comments')
      .select('id, event_id, member_id')
      .eq('id', commentId)
      .single();

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.member_id !== member_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete comment
    const { error: deleteErr } = await admin.from('feed_comments').delete().eq('id', commentId);
    if (deleteErr) {
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    // Atomic decrement of comment_count (prevents negative via GREATEST)
    await admin.rpc('increment_comment_count', { p_event_id: comment.event_id, p_delta: -1 }).then(({ error: rpcErr }) => {
      if (rpcErr) console.error('[comments] decrement_comment_count failed:', rpcErr.message);
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
