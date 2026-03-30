import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReadinessInputs } from '@nexera/types';

/**
 * Gathers readiness inputs from existing session data.
 * Pure DB reads — no computation. Uses admin client passed in.
 */
export async function gatherReadinessInputs(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<ReadinessInputs> {
  const today = new Date();
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  // Parallel queries for speed
  const [recentSessions, member, volumeHistory] = await Promise.all([
    // Sessions in last 3 calendar days (scoped to gym)
    admin
      .from('workout_sessions')
      .select('session_date, sets, total_volume_lbs, completed_at')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .gte('session_date', threeDaysAgoStr)
      .not('completed_at', 'is', null)
      .order('session_date', { ascending: false }),

    // Member streak data
    admin
      .from('members')
      .select('current_streak, last_session_date')
      .eq('id', memberId)
      .single(),

    // Last 4 sessions for volume trend (scoped to gym)
    admin
      .from('workout_sessions')
      .select('session_date, total_volume_lbs')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .not('completed_at', 'is', null)
      .order('session_date', { ascending: false })
      .limit(4),
  ]);

  // Count distinct session days in last 3 days
  const recentSessionDates = new Set(
    recentSessions.data?.map(s => s.session_date) ?? []
  );
  const sessionCountLast3Days = recentSessionDates.size;

  // Average RPE from most recent session
  const mostRecentSession = recentSessions.data?.[0];
  let lastSessionRPEAverage: number | null = null;
  if (mostRecentSession?.sets) {
    const sets = mostRecentSession.sets as Array<{ rpe?: number | null }>;
    const rpeSets = sets.filter(s => s.rpe !== null && s.rpe !== undefined);
    if (rpeSets.length > 0) {
      lastSessionRPEAverage =
        rpeSets.reduce((sum, s) => sum + (s.rpe as number), 0) / rpeSets.length;
    }
  }

  // Days since last session
  const lastSessionDate = member.data?.last_session_date;
  let daysSinceLastSession: number;
  if (lastSessionDate) {
    const lastDate = new Date(lastSessionDate);
    daysSinceLastSession = Math.floor(
      (today.getTime() - lastDate.getTime()) / 86400000
    );
  } else {
    daysSinceLastSession = 999;
  }

  // Volume trend: compare last session to rolling average of prior sessions
  const volumes = (volumeHistory.data ?? []).map(s => s.total_volume_lbs ?? 0);
  let volumeTrend: ReadinessInputs['volumeTrend'] = 'insufficient';
  if (volumes.length >= 3) {
    const latest = volumes[0];
    // Average of sessions 1..n-1 (excluding latest, index 0)
    const priorVolumes = volumes.slice(1);
    const average = priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length;
    if (average > 0) {
      const changePct = ((latest - average) / average) * 100;
      if (changePct > 10) volumeTrend = 'increasing';
      else if (changePct < -10) volumeTrend = 'decreasing';
      else volumeTrend = 'stable';
    }
  }

  return {
    sessionCountLast3Days,
    lastSessionRPEAverage,
    daysSinceLastSession,
    currentStreak: member.data?.current_streak ?? 0,
    volumeTrend,
  };
}
