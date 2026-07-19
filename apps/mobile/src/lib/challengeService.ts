/**
 * Challenge data layer — direct Supabase queries with RLS + API-route join.
 *
 * Mirrors feedService.ts structure:
 *  - Reads via direct Supabase under RLS (mobile has no cookie session)
 *  - Writes (join) via web-admin API route with Bearer JWT
 *
 * RLS ground truth:
 *  - gym_challenges SELECT: is_gym_member(gym_id) → "challenges_gym_members_read"
 *  - challenge_participants SELECT (own rows): member_id = auth.uid() → "challenge_participants_own"
 *  - challenge_participants SELECT (all gym): is_gym_member(gym_id) → Migration 028 "challenge_participants_member_gym_read"
 *    (Without Migration 028 the leaderboard participants list will return empty rows for other members)
 *
 * Anti-patterns to respect:
 *  - NEVER insert into challenge_participants directly from mobile — bypasses rate limit,
 *    feed event creation, and milestone logging in the web-admin join route.
 */
import { supabase } from './supabase';
import type { ChallengeListItem, ChallengeDetail, ChallengeParticipant } from '@nexera/types';
import { resolveMemberInfo } from './feedService';
import { progressPct } from './challengeLogic';

// ─── Cache key helpers ────────────────────────────────────────────────────────

/** Cache key for the challenges list screen. Use with CacheTTL.challengesList. */
export function CHALLENGES_CACHE_KEY(gymId: string): string {
  return `challenges:${gymId}`;
}

/** Cache key for a single challenge detail. Use with CacheTTL.challengeDetail. */
export function CHALLENGE_DETAIL_CACHE_KEY(challengeId: string): string {
  return `challenge:${challengeId}`;
}

// ─── fetchChallenges ──────────────────────────────────────────────────────────

/**
 * Fetch all gym challenges visible to a member: active ones + completed
 * within the last 30 days.
 *
 * Returns ChallengeListItem[] with is_joined, my_score, rank, total_participants,
 * progress_pct, and days_left mapped from DB rows and own participation.
 *
 * Throws on Supabase error (network or RLS issue).
 */
export async function fetchChallenges(
  gymId: string,
  memberId: string,
): Promise<ChallengeListItem[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: challengeRows, error: challengeError } = await supabase
    .from('gym_challenges')
    .select('id, title, description, challenge_type, start_date, end_date, is_active, top_score, created_at')
    .eq('gym_id', gymId)
    .or(`is_active.eq.true,end_date.gte.${thirtyDaysAgo}`)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  if (challengeError) throw challengeError;

  const challenges = challengeRows ?? [];
  if (challenges.length === 0) return [];

  const ids = challenges.map((c) => c.id);

  // Fetch own participation rows and total counts in parallel (no N+1)
  const [ownParticipations, allParticipants] = await Promise.all([
    supabase
      .from('challenge_participants')
      .select('challenge_id, current_score, current_rank')
      .eq('member_id', memberId)
      .in('challenge_id', ids),
    supabase
      .from('challenge_participants')
      .select('challenge_id')
      .in('challenge_id', ids),
  ]);

  // Build lookup maps in JS (no N+1)
  const ownMap = new Map<string, { current_score: number; current_rank: number }>();
  for (const row of ownParticipations.data ?? []) {
    ownMap.set(row.challenge_id, {
      current_score: row.current_score,
      current_rank: row.current_rank,
    });
  }

  const countMap = new Map<string, number>();
  for (const row of allParticipants.data ?? []) {
    countMap.set(row.challenge_id, (countMap.get(row.challenge_id) ?? 0) + 1);
  }

  return challenges.map((c) => {
    const own = ownMap.get(c.id);
    const topScore = c.top_score ?? 0;
    const myScore = own ? own.current_score : null;
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );

    return {
      challenge_id: c.id,
      title: c.title,
      description: c.description ?? null,
      challenge_type: c.challenge_type,
      start_date: c.start_date,
      end_date: c.end_date,
      is_active: c.is_active,
      is_joined: !!own,
      my_score: myScore,
      top_score: topScore,
      rank: own ? own.current_rank : 0,
      total_participants: countMap.get(c.id) ?? 0,
      progress_pct: progressPct(myScore, topScore),
      days_left: daysLeft,
    };
  });
}

// ─── fetchChallengeDetail ─────────────────────────────────────────────────────

/**
 * Fetch full challenge detail with leaderboard participants and resolved names.
 *
 * Returns null (not a throw) when the challenge row is missing — handles stale
 * deep links to deleted or expired challenges gracefully.
 *
 * Participant reads require Migration 028 (`challenge_participants_member_gym_read`)
 * to return other members' rows. Without it, only the current member's own row
 * will be visible.
 */
export async function fetchChallengeDetail(
  challengeId: string,
  memberId: string,
): Promise<ChallengeDetail | null> {
  const { data: challengeRow } = await supabase
    .from('gym_challenges')
    .select(
      'id, title, description, challenge_type, start_date, end_date, is_active, top_score, entry_mode, prize_type, prize_description, created_at',
    )
    .eq('id', challengeId)
    .maybeSingle();

  // Graceful null — not a throw (handles deleted/stale deep link)
  if (!challengeRow) return null;

  // Fetch participants ordered by rank
  const { data: participantRows } = await supabase
    .from('challenge_participants')
    .select('member_id, current_score, current_rank, joined_at')
    .eq('challenge_id', challengeId)
    .order('current_rank', { ascending: true });

  const rows = participantRows ?? [];

  // Resolve display names + avatars via compatibility views (feedService pattern)
  const memberIds = rows.map((r) => r.member_id);
  const memberInfo = await resolveMemberInfo(memberIds);

  const participants: ChallengeParticipant[] = rows.map((r) => {
    const info = memberInfo.get(r.member_id);
    return {
      member_id: r.member_id,
      display_name: info?.name ?? 'Member',
      avatar_url: info?.avatar_url ?? null,
      current_score: r.current_score,
      current_rank: r.current_rank,
      joined_at: r.joined_at,
    };
  });

  const myParticipation = participants.find((p) => p.member_id === memberId) ?? null;

  const topScore = challengeRow.top_score ?? 0;
  const myScore = myParticipation?.current_score ?? null;
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(challengeRow.end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  );

  return {
    challenge_id: challengeRow.id,
    title: challengeRow.title,
    description: challengeRow.description ?? null,
    challenge_type: challengeRow.challenge_type,
    start_date: challengeRow.start_date,
    end_date: challengeRow.end_date,
    is_active: challengeRow.is_active,
    is_joined: myParticipation !== null,
    my_score: myScore,
    top_score: topScore,
    rank: myParticipation?.current_rank ?? 0,
    total_participants: participants.length,
    progress_pct: progressPct(myScore, topScore),
    days_left: daysLeft,
    entry_mode: challengeRow.entry_mode,
    prize_type: challengeRow.prize_type ?? null,
    prize_description: challengeRow.prize_description ?? null,
    participants,
    my_participation: myParticipation,
  };
}

// ─── joinChallenge ────────────────────────────────────────────────────────────

export type JoinChallengeResult = 'joined' | 'already_joined' | 'ended' | 'error';

/**
 * Join a challenge via the web-admin API route.
 *
 * NEVER inserts directly into challenge_participants — the route handles:
 * rate limiting, feed event creation (challenge_joined), and milestone logging.
 *
 * Status mapping: 201 → 'joined', 409 → 'already_joined', 400 → 'ended',
 * anything else → 'error'. Network throw → 'error'.
 * No session token → 'error' without fetching.
 */
export async function joinChallenge(
  challengeId: string,
  memberId: string,
  gymId: string,
): Promise<JoinChallengeResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return 'error';

  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? '';

  try {
    const res = await fetch(
      `${apiBase}/api/member/challenges/${challengeId}/join`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ member_id: memberId, gym_id: gymId }),
      },
    );

    switch (res.status) {
      case 201:
        return 'joined';
      case 409:
        return 'already_joined';
      case 400:
        return 'ended';
      default:
        return 'error';
    }
  } catch {
    return 'error';
  }
}
