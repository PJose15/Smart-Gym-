import type { SupabaseClient } from '@supabase/supabase-js';
import type { DNASignals } from '@nexera/types';
import { buildMemberMuscleMap } from '@/lib/muscleMap/buildMemberMuscleMap';
import { calculateBalanceScore } from '@nexera/ai-assist';

/**
 * Gather all inputs needed for DNA computation from Supabase.
 * Runs parallel queries for speed.
 */
export async function gatherDNAInputs(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<DNASignals> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0];

  const [
    recentSessionsResult,
    olderSessionsResult,
    memberResult,
    allSessions60dResult,
    programsResult,
    goalsResult,
    readinessResult,
    sessionsForSets,
    checkInsResult,
    reactionsResult,
    sharesResult,
    totalCountResult,
    distinctMachinesResult,
    muscleMap,
  ] = await Promise.all([
    // Power: recent sessions (last 30 days)
    admin
      .from('workout_sessions')
      .select('machine_id, best_weight_lbs, total_volume_lbs')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .gte('session_date', thirtyDaysAgo)
      .not('completed_at', 'is', null),

    // Power: older sessions (30-60 days ago)
    admin
      .from('workout_sessions')
      .select('machine_id, best_weight_lbs')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .gte('session_date', sixtyDaysAgo)
      .lt('session_date', thirtyDaysAgo)
      .not('completed_at', 'is', null),

    // Consistency: member streak data
    admin
      .from('members')
      .select('current_streak, best_streak')
      .eq('id', memberId)
      .single(),

    // Progression: all sessions last 60 days
    admin
      .from('workout_sessions')
      .select('machine_id, session_date, best_weight_lbs, total_volume_lbs')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .gte('session_date', sixtyDaysAgo)
      .not('completed_at', 'is', null)
      .order('session_date', { ascending: true }),

    // Progression: recent programs
    admin
      .from('ai_programs')
      .select('sessions_completed, sessions_total')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(3),

    // Progression + Mindset: goals
    admin
      .from('member_goals')
      .select('is_achieved')
      .eq('member_id', memberId)
      .gte('created_at', new Date(now.getTime() - 60 * 86400000).toISOString()),

    // Consistency: readiness cache
    admin
      .from('member_readiness_cache')
      .select('score, zone')
      .eq('member_id', memberId)
      .gte('cache_date', thirtyDaysAgo),

    // Mindset: sessions with sets for RPE data
    admin
      .from('workout_sessions')
      .select('sets')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .gte('session_date', thirtyDaysAgo)
      .not('completed_at', 'is', null),

    // Mindset: check-ins
    admin
      .from('weekly_checkins')
      .select('member_replied')
      .eq('member_id', memberId)
      .gte('sent_at', new Date(now.getTime() - 30 * 86400000).toISOString())
      .not('sent_at', 'is', null),

    // Mindset: reactions
    admin
      .from('feed_reactions')
      .select('id')
      .eq('member_id', memberId)
      .gte('reacted_at', new Date(now.getTime() - 30 * 86400000).toISOString()),

    // Mindset: workout shares
    admin
      .from('workout_share_log')
      .select('id')
      .eq('member_id', memberId)
      .gte('shared_at', thirtyDaysAgo),

    // Meta: total session count
    admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .not('completed_at', 'is', null),

    // Meta: distinct machines
    admin
      .from('workout_sessions')
      .select('machine_id')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .not('completed_at', 'is', null)
      .not('machine_id', 'is', null),

    // Balance: muscle map
    buildMemberMuscleMap(memberId, gymId, admin),
  ]);

  // Log critical query errors (non-blocking)
  if (recentSessionsResult.error) console.error('[gatherDNAInputs] recentSessions error:', recentSessionsResult.error.message);
  if (memberResult.error) console.error('[gatherDNAInputs] member error:', memberResult.error.message);
  if (allSessions60dResult.error) console.error('[gatherDNAInputs] allSessions60d error:', allSessions60dResult.error.message);

  // Consistency: session dates last 30 days (from 60d sessions filtered)
  const recentDates = (allSessions60dResult.data ?? [])
    .filter(s => s.session_date >= thirtyDaysAgo)
    .map(s => s.session_date);

  // Mindset: extract all sets from sessions
  const allSets: Array<{ rpe: number | null }> = [];
  for (const session of sessionsForSets.data ?? []) {
    const sets = (session.sets ?? []) as Array<{ rpe?: number | null }>;
    for (const set of sets) {
      allSets.push({ rpe: set.rpe ?? null });
    }
  }

  // Goals
  const allGoals = goalsResult.data ?? [];

  // Distinct machines count
  const machineIds = new Set(
    (distinctMachinesResult.data ?? []).map(s => s.machine_id).filter(Boolean)
  );

  return {
    recentSessions: (recentSessionsResult.data ?? []).map(s => ({
      machine_id: s.machine_id,
      best_weight_lbs: s.best_weight_lbs ?? 0,
      total_volume_lbs: s.total_volume_lbs ?? 0,
    })),
    olderSessions: (olderSessionsResult.data ?? []).map(s => ({
      machine_id: s.machine_id,
      best_weight_lbs: s.best_weight_lbs ?? 0,
    })),
    sessionDatesLast30: recentDates,
    currentStreak: memberResult.data?.current_streak ?? 0,
    bestStreak: memberResult.data?.best_streak ?? 0,
    readinessEntries: (readinessResult.data ?? []).map(r => ({
      score: r.score,
      zone: r.zone as string,
    })),
    allSessions60d: (allSessions60dResult.data ?? []).map(s => ({
      machine_id: s.machine_id,
      session_date: s.session_date,
      best_weight_lbs: s.best_weight_lbs ?? 0,
      total_volume_lbs: s.total_volume_lbs ?? 0,
    })),
    programs: (programsResult.data ?? []).map(p => ({
      sessions_completed: p.sessions_completed ?? 0,
      sessions_total: p.sessions_total ?? 0,
    })),
    goals: allGoals.map(g => ({ is_achieved: g.is_achieved })),
    balanceScore: Number.isFinite(muscleMap.balanceScore) ? Math.max(0, Math.min(100, muscleMap.balanceScore)) : 0,
    allSets,
    checkIns: (checkInsResult.data ?? []).map(c => ({
      member_replied: c.member_replied,
    })),
    goalsSet: allGoals.length,
    goalsAchieved: allGoals.filter(g => g.is_achieved).length,
    reactionCount: reactionsResult.data?.length ?? 0,
    shareCount: sharesResult.data?.length ?? 0,
    totalSessionCount: totalCountResult.count ?? 0,
    distinctMachineCount: machineIds.size,
  };
}
