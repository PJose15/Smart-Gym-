import type { SupabaseClient } from '@supabase/supabase-js';
import type { MachineLeaderboardEntry } from '@nexera/types';

/**
 * Get per-machine leaderboard ranked by best single-set weight.
 * Returns empty if fewer than 3 members have sessions on this machine.
 */
export async function getMachineLeaderboard(
  machineId: string,
  gymId: string,
  currentMemberId: string,
  limit: number = 10,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<MachineLeaderboardEntry[]> {
  // Get best weight per member on this machine
  const { data: sessions } = await admin
    .from('workout_sessions')
    .select('member_id, total_volume_lbs, completed_at, sets, members(display_name, avatar_url)')
    .eq('machine_id', machineId)
    .eq('gym_id', gymId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(500);

  if (!sessions || sessions.length === 0) return [];

  // Build best weight per member
  const memberBests: Record<string, { weight: number; at: string; name: string; avatar: string | null }> = {};

  for (const session of sessions) {
    const sets = (session.sets ?? []) as Array<{ weight_lbs?: number }>;
    for (const set of sets) {
      const weightLbs = Math.round(set.weight_lbs ?? 0);
      if (weightLbs <= 0) continue;

      const mid = session.member_id as string;
      const member = session.members as unknown as { display_name: string; avatar_url: string | null } | null;

      if (!memberBests[mid] || weightLbs > memberBests[mid].weight) {
        memberBests[mid] = {
          weight: weightLbs,
          at: session.completed_at as string,
          name: member?.display_name ?? 'Member',
          avatar: member?.avatar_url ?? null,
        };
      }
    }
  }

  const uniqueMembers = Object.keys(memberBests);
  if (uniqueMembers.length < 3) return []; // Don't show with < 3 members

  // Sort by weight desc, then by date asc (earlier PR wins ties)
  const sorted = uniqueMembers
    .map(mid => ({ mid, ...memberBests[mid] }))
    .sort((a, b) => b.weight - a.weight || new Date(a.at).getTime() - new Date(b.at).getTime());

  // Build entries with ranks
  const entries: MachineLeaderboardEntry[] = [];
  const topSlice = sorted.slice(0, limit);

  for (let i = 0; i < topSlice.length; i++) {
    const item = topSlice[i];
    entries.push({
      rank: i + 1,
      member_id: item.mid,
      display_name: item.name,
      avatar_url: item.avatar,
      best_weight_lbs: item.weight,
      achieved_at: item.at,
      is_current_member: item.mid === currentMemberId,
    });
  }

  // If current member not in top N, append their entry
  const currentInList = entries.some(e => e.is_current_member);
  if (!currentInList && memberBests[currentMemberId]) {
    const currentIdx = sorted.findIndex(s => s.mid === currentMemberId);
    if (currentIdx >= 0) {
      const item = sorted[currentIdx];
      entries.push({
        rank: currentIdx + 1,
        member_id: item.mid,
        display_name: item.name,
        avatar_url: item.avatar,
        best_weight_lbs: item.weight,
        achieved_at: item.at,
        is_current_member: true,
      });
    }
  }

  return entries;
}
