/**
 * Feed data layer — direct Supabase queries with RLS (mobile has no
 * cookie session, so the web-admin API routes are not usable here).
 *
 * RLS ground truth (supabase/migrations):
 *  - gym_feed_events  SELECT: is_gym_member(gym_id)  (001 "feed_gym_members_read")
 *  - feed_reactions   ALL:    event in own gym       (001 "reactions_gym_members")
 *  - feed_comments    ALL:    event in own gym       (001 "comments_gym_members")
 *  - social_connections SELECT gym-scoped, INSERT/DELETE own follower rows (024)
 *  - members          SELECT: own row only — other members' names/avatars are
 *    resolved through the RLS-bypassing compatibility views `gym_members`
 *    (members.id → user_id) and `profiles` (users.display_name/avatar_url)
 *    from migration 021, the same path the leaderboard service uses.
 */
import { supabase } from './supabase';
import type { FeedComment, FeedEventFull, FeedReactionCounts, ReactionType } from '@nexera/types';

export const FEED_PAGE_SIZE = 20;
export const COMMENTS_PAGE_SIZE = 50;

const EVENT_COLS =
  'id, gym_id, member_id, event_type, display_text, context_data, priority, is_pinned, comment_count, created_at';

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

export interface FeedPage {
  events: FeedEventFull[];
  nextCursor: string | null;
}

// ─── Member identity lookup (name + avatar via compatibility views) ─────────

export async function resolveMemberInfo(
  memberIds: string[],
): Promise<Map<string, { name: string; avatar_url: string | null }>> {
  const map = new Map<string, { name: string; avatar_url: string | null }>();
  if (memberIds.length === 0) return map;

  // members.id → user_id (gym_members view exposes user_id as profile_id)
  const { data: memberRows } = await supabase
    .from('gym_members')
    .select('id, profile_id')
    .in('id', memberIds);

  const profileIds = [...new Set((memberRows ?? []).map((m) => m.profile_id).filter(Boolean))];
  if (profileIds.length === 0) return map;

  // user_id → display name + avatar (profiles view over users)
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', profileIds);

  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  for (const p of profileRows ?? []) {
    profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
  }

  for (const m of memberRows ?? []) {
    const profile = m.profile_id ? profileMap.get(m.profile_id) : undefined;
    map.set(m.id, {
      name: profile?.full_name || 'Member',
      avatar_url: profile?.avatar_url || null,
    });
  }
  return map;
}

// ─── Event enrichment (names, reactions, live comment counts) ───────────────

async function enrichEvents(rows: FeedEventRow[], myMemberId: string): Promise<FeedEventFull[]> {
  if (rows.length === 0) return [];

  const eventIds = rows.map((e) => e.id);
  const memberIds = [...new Set(rows.map((e) => e.member_id).filter(Boolean))] as string[];

  const [memberInfo, reactionsResult, commentsResult] = await Promise.all([
    resolveMemberInfo(memberIds),
    supabase.from('feed_reactions').select('event_id, member_id, reaction_type').in('event_id', eventIds),
    // Live count — the comment_count column is only maintained by the
    // service-role web path; mobile-posted comments can't bump it (RLS).
    supabase.from('feed_comments').select('event_id').in('event_id', eventIds),
  ]);

  const countsByEvent = new Map<string, FeedReactionCounts>();
  const mineByEvent = new Map<string, ReactionType[]>();
  for (const r of reactionsResult.data ?? []) {
    const counts =
      countsByEvent.get(r.event_id) ?? { strength: 0, fire: 0, champion: 0, letsgo: 0 };
    counts[r.reaction_type as ReactionType]++;
    countsByEvent.set(r.event_id, counts);
    if (r.member_id === myMemberId) {
      const mine = mineByEvent.get(r.event_id) ?? [];
      mine.push(r.reaction_type as ReactionType);
      mineByEvent.set(r.event_id, mine);
    }
  }

  const commentCountByEvent = new Map<string, number>();
  for (const c of commentsResult.data ?? []) {
    commentCountByEvent.set(c.event_id, (commentCountByEvent.get(c.event_id) ?? 0) + 1);
  }

  return rows.map((e) => {
    const info = e.member_id ? memberInfo.get(e.member_id) : undefined;
    const reactions =
      countsByEvent.get(e.id) ?? { strength: 0, fire: 0, champion: 0, letsgo: 0 };
    return {
      id: e.id,
      event_type: e.event_type,
      member_name: info?.name || 'Member',
      description: e.display_text,
      created_at: e.created_at,
      reaction_count:
        reactions.strength + reactions.fire + reactions.champion + reactions.letsgo,
      member_id: e.member_id,
      avatar_url: info?.avatar_url || null,
      context_data: e.context_data || {},
      priority: e.priority,
      is_pinned: e.is_pinned,
      comment_count: commentCountByEvent.get(e.id) ?? e.comment_count ?? 0,
      reactions,
      my_reactions: mineByEvent.get(e.id) ?? [],
    };
  });
}

// ─── Feed pages ─────────────────────────────────────────────────────────────

/**
 * Fetch one feed page. First page (no cursor) includes up to 5 pinned
 * events on top, mirroring /api/member/feed.
 */
export async function fetchFeedPage(
  gymId: string,
  myMemberId: string,
  cursor?: string | null,
): Promise<FeedPage> {
  let pinnedRows: FeedEventRow[] = [];
  if (!cursor) {
    const { data } = await supabase
      .from('gym_feed_events')
      .select(EVENT_COLS)
      .eq('gym_id', gymId)
      .eq('is_pinned', true)
      .neq('priority', 'hidden')
      .order('created_at', { ascending: false })
      .limit(5);
    pinnedRows = (data ?? []) as unknown as FeedEventRow[];
  }

  let query = supabase
    .from('gym_feed_events')
    .select(EVENT_COLS)
    .eq('gym_id', gymId)
    .eq('is_pinned', false)
    .neq('priority', 'hidden')
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor) query = query.lt('created_at', cursor);

  const { data: chronoData, error } = await query;
  if (error) throw error;

  const chronoRows = (chronoData ?? []) as unknown as FeedEventRow[];

  // Dedupe (a pinned event can't be in the chrono set, but stay defensive)
  const seen = new Set<string>();
  const rows = [...pinnedRows, ...chronoRows].filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const events = await enrichEvents(rows, myMemberId);
  const nextCursor =
    chronoRows.length === FEED_PAGE_SIZE
      ? chronoRows[chronoRows.length - 1].created_at
      : null;

  return { events, nextCursor };
}

/** Fetch events newer than `sinceIso` (realtime prepend path). */
export async function fetchEventsSince(
  gymId: string,
  myMemberId: string,
  sinceIso: string,
): Promise<FeedEventFull[]> {
  const { data, error } = await supabase
    .from('gym_feed_events')
    .select(EVENT_COLS)
    .eq('gym_id', gymId)
    .neq('priority', 'hidden')
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (error) throw error;
  return enrichEvents((data ?? []) as unknown as FeedEventRow[], myMemberId);
}

// ─── Reactions ──────────────────────────────────────────────────────────────

/**
 * Persist a reaction toggle. `wasActive` is the state BEFORE the optimistic
 * update (i.e. true means the user is removing the reaction).
 */
export async function persistReactionToggle(
  eventId: string,
  myMemberId: string,
  type: ReactionType,
  wasActive: boolean,
): Promise<void> {
  if (wasActive) {
    const { error } = await supabase
      .from('feed_reactions')
      .delete()
      .eq('event_id', eventId)
      .eq('member_id', myMemberId)
      .eq('reaction_type', type);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('feed_reactions').insert({
      event_id: eventId,
      member_id: myMemberId,
      reaction_type: type,
    });
    // 23505 = UNIQUE violation from a double-tap race — already reacted, fine.
    if (error && error.code !== '23505') throw error;
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

export interface CommentsPage {
  comments: FeedComment[];
  nextCursor: string | null;
}

export async function fetchComments(eventId: string, cursor?: string | null): Promise<CommentsPage> {
  let query = supabase
    .from('feed_comments')
    .select('id, member_id, comment_text, mentioned_member_ids, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(COMMENTS_PAGE_SIZE + 1);

  if (cursor) query = query.gt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;

  const rowsAll = data ?? [];
  const hasMore = rowsAll.length > COMMENTS_PAGE_SIZE;
  const rows = hasMore ? rowsAll.slice(0, COMMENTS_PAGE_SIZE) : rowsAll;

  const memberIds = [...new Set(rows.map((c) => c.member_id))];
  const memberInfo = await resolveMemberInfo(memberIds);

  const comments: FeedComment[] = rows.map((c) => ({
    id: c.id,
    member_id: c.member_id,
    member_name: memberInfo.get(c.member_id)?.name || 'Member',
    avatar_url: memberInfo.get(c.member_id)?.avatar_url || null,
    comment_text: c.comment_text,
    mentioned_member_ids: c.mentioned_member_ids || [],
    created_at: c.created_at,
  }));

  return {
    comments,
    nextCursor: hasMore && comments.length > 0 ? comments[comments.length - 1].created_at : null,
  };
}

export async function postComment(
  eventId: string,
  myMemberId: string,
  text: string,
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabase
    .from('feed_comments')
    .insert({
      event_id: eventId,
      member_id: myMemberId,
      comment_text: text,
      mentioned_member_ids: [],
    })
    .select('id, created_at')
    .single();

  if (error) throw error;

  // Best effort: keep the denormalized comment_count column in sync for the
  // web UI. The RPC runs with invoker rights so under current RLS it's a
  // silent no-op for members — harmless, and it starts working if the
  // function is later made SECURITY DEFINER.
  supabase.rpc('increment_comment_count', { p_event_id: eventId, p_delta: 1 }).then(
    () => undefined,
    () => undefined,
  );

  return data;
}

export async function deleteComment(commentId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from('feed_comments').delete().eq('id', commentId);
  if (error) throw error;

  supabase.rpc('increment_comment_count', { p_event_id: eventId, p_delta: -1 }).then(
    () => undefined,
    () => undefined,
  );
}

// ─── Workout share (DOC_05 §8 — gym_feed_events + workout_share_log) ────────

export type ShareWorkoutResult = 'shared' | 'already_shared' | 'unavailable';

/** Postgres "insufficient privilege" — RLS denied (migration 025 not applied). */
const PG_RLS_DENIED = '42501';
/** Postgres unique violation — UNIQUE(member_id, shared_at) race. */
const PG_UNIQUE_VIOLATION = '23505';

/** True if the member already has a workout_share_log row for `sharedAt` (UTC date). */
export async function hasSharedToday(memberId: string, sharedAt: string): Promise<boolean> {
  const { data } = await supabase
    .from('workout_share_log')
    .select('id')
    .eq('member_id', memberId)
    .eq('shared_at', sharedAt)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Post a completed-workout share to the gym feed and record it in
 * workout_share_log (one share per member per UTC day).
 *
 * Inserts directly under RLS via migration 025's "feed_member_share_insert"
 * policy. If that policy is not yet applied (RLS denied), resolves to
 * 'unavailable' instead of throwing so the UI can degrade gracefully.
 */
export async function shareWorkoutToFeed(params: {
  memberId: string;
  gymId: string;
  displayText: string;
  contextData: Record<string, unknown>;
  sharedAt: string;
}): Promise<ShareWorkoutResult> {
  const { memberId, gymId, displayText, contextData, sharedAt } = params;

  // One share per day (UNIQUE(member_id, shared_at) is the hard guarantee;
  // this pre-check avoids creating an orphan feed event in the common case).
  if (await hasSharedToday(memberId, sharedAt)) return 'already_shared';

  const { data: event, error } = await supabase
    .from('gym_feed_events')
    .insert({
      gym_id: gymId,
      member_id: memberId,
      event_type: 'workout_share',
      display_text: displayText,
      context_data: contextData,
      priority: 'low',
    })
    .select('id')
    .single();

  if (error || !event) {
    if (error?.code === PG_RLS_DENIED) return 'unavailable';
    throw error ?? new Error('Workout share insert returned no row');
  }

  const { error: logError } = await supabase.from('workout_share_log').insert({
    member_id: memberId,
    gym_id: gymId,
    event_id: event.id,
    shared_at: sharedAt,
    status: 'completed',
  });

  if (logError) {
    // Double-tap / multi-device race lost to another share today (rare —
    // the pre-check covers the normal path). The duplicate feed event row
    // exists but members cannot DELETE it; surface the already-shared state.
    if (logError.code === PG_UNIQUE_VIOLATION) return 'already_shared';
    // Log write failed for another reason — the share itself is live.
  }

  return 'shared';
}

// ─── Follow / unfollow (social_connections, migration 024) ──────────────────

export async function fetchFollowingIds(myMemberId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('social_connections')
    .select('following_id')
    .eq('follower_id', myMemberId);
  return new Set((data ?? []).map((r) => r.following_id));
}

export async function followMember(myMemberId: string, targetMemberId: string): Promise<void> {
  const { error } = await supabase.from('social_connections').insert({
    follower_id: myMemberId,
    following_id: targetMemberId,
  });
  // 23505 = already following — treat as success.
  if (error && error.code !== '23505') throw error;
}

export async function unfollowMember(myMemberId: string, targetMemberId: string): Promise<void> {
  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('follower_id', myMemberId)
    .eq('following_id', targetMemberId);
  if (error) throw error;
}

// ─── Feed screen context (own member row + gym name) ────────────────────────

export interface FeedContext {
  memberId: string;
  gymId: string;
  gymName: string | null;
}

export async function fetchFeedContext(): Promise<FeedContext | 'signed-out' | null> {
  // getSession reads locally — getUser() round-trips to the auth server and
  // returns null on transient/revoked-session failures, which used to render
  // as a fake "check your connection" error. A missing session is reported
  // distinctly so the screen can send the user back to sign-in instead.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return 'signed-out';

  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!member?.gym_id) return null;

  const { data: gym } = await supabase
    .from('gyms')
    .select('name')
    .eq('id', member.gym_id)
    .maybeSingle();

  return { memberId: member.id, gymId: member.gym_id, gymName: gym?.name ?? null };
}
