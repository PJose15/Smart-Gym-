import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { feedQuerySchema } from '@/lib/validation/feed';
import type { FeedEventFull, FeedReactionCounts, ReactionType } from '@nexera/types';

interface FeedEventRow {
  id: string;
  gym_id: string;
  member_id: string | null;
  event_type: string;
  display_text: string;
  context_data: Record<string, unknown> | null;
  priority: string;
  is_pinned: boolean;
  comment_count: number;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const parsed = feedQuerySchema.safeParse({
      member_id: sp.get('member_id'),
      gym_id: sp.get('gym_id'),
      cursor: sp.get('cursor') || undefined,
      limit: sp.get('limit') ?? '20',
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, gym_id, cursor, limit } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Query feed events — pinned always included, then chronological with cursor
    const selectCols = 'id, gym_id, member_id, event_type, display_text, context_data, priority, is_pinned, comment_count, created_at';

    // First, get pinned events (only on first page, no cursor)
    let pinnedEvents: FeedEventRow[] = [];
    if (!cursor) {
      const { data: pinned } = await admin
        .from('gym_feed_events')
        .select(selectCols)
        .eq('gym_id', gym_id)
        .eq('is_pinned', true)
        .neq('priority', 'hidden')
        .order('created_at', { ascending: false })
        .limit(5);
      pinnedEvents = (pinned ?? []) as unknown as FeedEventRow[];
    }

    // Then get non-pinned chronological events
    let query = admin
      .from('gym_feed_events')
      .select(selectCols)
      .eq('gym_id', gym_id)
      .eq('is_pinned', false)
      .neq('priority', 'hidden')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: chronoEvents, error: eventsErr } = await query;

    // Merge pinned + chronological, dedup by id
    const seenIds = new Set<string>();
    const allEvents = (chronoEvents ?? []) as unknown as FeedEventRow[];
    const events = [...pinnedEvents, ...allEvents].filter(e => {
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });

    if (eventsErr) {
      return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ events: [], next_cursor: null });
    }

    // Fetch member info, all reactions, and my reactions in parallel
    const memberIds = [...new Set(events.map(e => e.member_id).filter(Boolean))] as string[];
    const eventIds = events.map(e => e.id);

    const [membersResult, reactionsResult, myReactionsResult] = await Promise.all([
      memberIds.length > 0
        ? admin.from('members').select('id, display_name, avatar_url').in('id', memberIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
      admin.from('feed_reactions').select('event_id, reaction_type').in('event_id', eventIds),
      admin.from('feed_reactions').select('event_id, reaction_type').in('event_id', eventIds).eq('member_id', member_id),
    ]);

    const members = membersResult.data;
    const reactions = reactionsResult.data;
    const myReactions = myReactionsResult.data;

    const memberMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members ?? []) {
      memberMap.set(m.id, { display_name: m.display_name, avatar_url: m.avatar_url });
    }

    // Build reaction count maps
    const reactionCountMap = new Map<string, FeedReactionCounts>();
    for (const r of reactions ?? []) {
      const counts = reactionCountMap.get(r.event_id) || { strength: 0, fire: 0, champion: 0, letsgo: 0 };
      counts[r.reaction_type as ReactionType]++;
      reactionCountMap.set(r.event_id, counts);
    }

    const myReactionMap = new Map<string, ReactionType[]>();
    for (const r of myReactions ?? []) {
      const list = myReactionMap.get(r.event_id) || [];
      list.push(r.reaction_type as ReactionType);
      myReactionMap.set(r.event_id, list);
    }

    const result: FeedEventFull[] = events.map(e => {
      const memberInfo = e.member_id ? memberMap.get(e.member_id) : null;
      const reactionCounts = reactionCountMap.get(e.id) || { strength: 0, fire: 0, champion: 0, letsgo: 0 };
      const totalReactions = reactionCounts.strength + reactionCounts.fire + reactionCounts.champion + reactionCounts.letsgo;

      return {
        id: e.id,
        event_type: e.event_type,
        member_name: memberInfo?.display_name || 'Member',
        description: e.display_text,
        created_at: e.created_at,
        reaction_count: totalReactions,
        member_id: e.member_id,
        avatar_url: memberInfo?.avatar_url || null,
        context_data: e.context_data || {},
        priority: e.priority,
        is_pinned: e.is_pinned,
        comment_count: e.comment_count || 0,
        reactions: reactionCounts,
        my_reactions: myReactionMap.get(e.id) || [],
      };
    });

    const lastEvent = events[events.length - 1];
    const next_cursor = events.length === limit ? lastEvent.created_at : null;

    return NextResponse.json({ events: result, next_cursor });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
