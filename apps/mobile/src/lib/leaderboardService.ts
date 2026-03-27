import { supabase } from './supabase';
import type { LeaderboardEntry, LeaderboardPeriod } from '@nexera/types';

/**
 * Fetches the leaderboard for a gym using the get_leaderboard RPC.
 * Joins profile names and marks the current user.
 */
export async function getLeaderboard(
  gymId: string,
  currentUserId: string,
  period: LeaderboardPeriod,
  limit: number = 50,
): Promise<LeaderboardEntry[]> {
  // Calculate the "since" timestamp for weekly period
  let since: string | null = null;
  if (period === 'weekly') {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? 6 : day - 1); // Monday as week start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    since = monday.toISOString();
  }

  const { data: rankings, error: rpcErr } = await supabase.rpc('get_leaderboard', {
    p_gym_id: gymId,
    p_since: since,
    p_limit: limit,
  });

  if (rpcErr) throw rpcErr;
  if (!rankings || rankings.length === 0) return [];

  // Fetch profile names for the ranked users
  const profileIds = rankings.map((r: { profile_id: string }) => r.profile_id);
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', profileIds);

  if (profileErr) throw profileErr;

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { full_name: p.full_name || 'Unknown', avatar_url: p.avatar_url });
  }

  return rankings.map((r: { profile_id: string; total_points: number }, index: number) => {
    const profile = profileMap.get(r.profile_id);
    return {
      rank: index + 1,
      profile_id: r.profile_id,
      full_name: profile?.full_name || 'Unknown',
      avatar_url: profile?.avatar_url || null,
      total_points: Number(r.total_points),
      is_current_user: r.profile_id === currentUserId,
    };
  });
}

/**
 * Gets just the current user's rank (for the home screen preview).
 */
export async function getUserRank(
  gymId: string,
  currentUserId: string,
  period: LeaderboardPeriod,
): Promise<{ rank: number; total: number } | null> {
  const entries = await getLeaderboard(gymId, currentUserId, period);
  const userEntry = entries.find((e) => e.is_current_user);
  if (!userEntry) return null;
  return { rank: userEntry.rank, total: entries.length };
}
