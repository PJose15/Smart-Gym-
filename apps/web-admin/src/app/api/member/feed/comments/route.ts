import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { feedCommentsQuerySchema, feedCommentSchema } from '@/lib/validation/feed';
import type { FeedComment } from '@nexera/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const parsed = feedCommentsQuerySchema.safeParse({
      event_id: sp.get('event_id'),
      member_id: sp.get('member_id'),
    });
    const cursor = sp.get('cursor'); // created_at ISO string for pagination
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 100);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { event_id, member_id } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    let query = admin
      .from('feed_comments')
      .select('id, member_id, comment_text, mentioned_member_ids, created_at')
      .eq('event_id', event_id)
      .order('created_at', { ascending: true })
      .limit(limit + 1); // fetch one extra to detect hasMore

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: rawComments, error: commentsErr } = await query;

    const hasMore = (rawComments?.length ?? 0) > limit;
    const comments = hasMore ? rawComments!.slice(0, limit) : (rawComments ?? []);

    if (commentsErr) {
      return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
    }

    // Get member display info
    const memberIds = [...new Set((comments ?? []).map(c => c.member_id))];
    const { data: members } = memberIds.length > 0
      ? await admin
          .from('members')
          .select('id, display_name, avatar_url')
          .in('id', memberIds)
      : { data: [] };

    const memberMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members ?? []) {
      memberMap.set(m.id, { display_name: m.display_name, avatar_url: m.avatar_url });
    }

    const result: FeedComment[] = (comments ?? []).map(c => ({
      id: c.id,
      member_id: c.member_id,
      member_name: memberMap.get(c.member_id)?.display_name || 'Member',
      avatar_url: memberMap.get(c.member_id)?.avatar_url || null,
      comment_text: c.comment_text,
      mentioned_member_ids: c.mentioned_member_ids || [],
      created_at: c.created_at,
    }));

    const next_cursor = hasMore && result.length > 0
      ? result[result.length - 1].created_at
      : null;

    return NextResponse.json({ comments: result, next_cursor });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = feedCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, event_id, comment_text, mentioned_member_ids } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Insert comment
    const { data: comment, error: insertErr } = await admin
      .from('feed_comments')
      .insert({
        event_id,
        member_id,
        comment_text,
        mentioned_member_ids: mentioned_member_ids || [],
      })
      .select('id, created_at')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
    }

    // Atomic increment of comment_count
    await admin.rpc('increment_comment_count', { p_event_id: event_id, p_delta: 1 }).then(({ error: rpcErr }) => {
      if (rpcErr) console.error('[comments] increment_comment_count failed:', rpcErr.message);
    });

    return NextResponse.json({
      id: comment.id,
      created_at: comment.created_at,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
