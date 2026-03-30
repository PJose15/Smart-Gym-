import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckInWeekData, PRDetail } from '@nexera/types';
import { buildMemberMuscleMap } from '@/lib/muscleMap/buildMemberMuscleMap';
import { MUSCLE_GROUPS, calculateBalanceScore } from '@nexera/ai-assist';
import { toDateString, getWeekEnd } from './weekDateUtils';
import { getDNAResult } from '@/lib/dna/dnaCache';

/**
 * Gather all data needed for a weekly check-in message.
 * Runs parallel queries for speed.
 */
export async function gatherCheckInWeekData(
  memberId: string,
  gymId: string,
  weekStart: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<CheckInWeekData> {
  const weekEnd = getWeekEnd(weekStart);
  const weekStartStr = toDateString(weekStart);
  const weekEndStr = toDateString(weekEnd);

  // Last week range
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setUTCDate(lastWeekEnd.getUTCDate() - 1);
  const lastWeekStartStr = toDateString(lastWeekStart);
  const lastWeekEndStr = toDateString(lastWeekEnd);

  const [
    memberResult,
    thisWeekSessions,
    lastWeekSessions,
    activeProgram,
    readinessData,
    muscleMap,
  ] = await Promise.all([
    // Member profile
    admin
      .from('members')
      .select(
        'id, display_name, primary_goal, experience_level, joined_at, current_streak, injuries_or_limitations, assigned_trainer_id'
      )
      .eq('id', memberId)
      .single(),

    // Sessions this week (scoped to gym)
    admin
      .from('workout_sessions')
      .select('id, session_date, total_volume_lbs, sets, completed_at, machine_id, machines(name)')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .not('completed_at', 'is', null)
      .gte('session_date', weekStartStr)
      .lte('session_date', weekEndStr),

    // Sessions last week (scoped to gym)
    admin
      .from('workout_sessions')
      .select('id, total_volume_lbs, sets')
      .eq('member_id', memberId)
      .eq('gym_id', gymId)
      .not('completed_at', 'is', null)
      .gte('session_date', lastWeekStartStr)
      .lte('session_date', lastWeekEndStr),

    // Active program
    admin
      .from('member_program_assignments')
      .select('program_id, programs(name)')
      .eq('member_id', memberId)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Readiness cache entries for this week
    admin
      .from('member_readiness_cache')
      .select('score, zone')
      .eq('member_id', memberId)
      .gte('cache_date', weekStartStr)
      .lte('cache_date', weekEndStr),

    // Muscle map (current state)
    buildMemberMuscleMap(memberId, gymId, admin),
  ]);

  const member = memberResult.data;
  const sessions = thisWeekSessions.data ?? [];
  const lastSessions = lastWeekSessions.data ?? [];

  // Trainer name lookup if assigned
  let trainerName: string | null = null;
  if (member?.assigned_trainer_id) {
    const { data: trainer } = await admin
      .from('users')
      .select('display_name')
      .eq('id', member.assigned_trainer_id)
      .single();
    trainerName = trainer?.display_name ?? null;
  }

  // DNA data from cache (fire-and-forget — don't block check-in if DNA fails)
  let dnaConsistency: number | null = null;
  let dnaProgression: number | null = null;
  let dnaTrend: string | null = null;
  try {
    const dna = await getDNAResult(memberId, gymId, admin);
    if (!dna.is_building) {
      dnaConsistency = dna.scores.consistency;
      dnaProgression = dna.scores.progression;
      if (dna.previous_scores) {
        const prevAvg = (dna.previous_scores.power + dna.previous_scores.consistency + dna.previous_scores.progression + dna.previous_scores.balance + dna.previous_scores.mindset) / 5;
        const currAvg = (dna.scores.power + dna.scores.consistency + dna.scores.progression + dna.scores.balance + dna.scores.mindset) / 5;
        dnaTrend = currAvg > prevAvg + 2 ? 'improving' : currAvg < prevAvg - 2 ? 'declining' : 'stable';
      }
    }
  } catch {
    // DNA not available yet — leave nulls
  }

  // PR details — find sets with is_personal_best
  const prDetails: PRDetail[] = [];
  for (const session of sessions) {
    const sets = (session.sets ?? []) as Array<{
      weight_kg?: number;
      reps?: number;
      rpe?: number | null;
      is_personal_best?: boolean;
      pr_improvement_lbs?: number;
    }>;
    for (const set of sets) {
      if (set.is_personal_best) {
        const machineName =
          (session.machines as unknown as { name: string } | null)?.name ?? 'Unknown';
        prDetails.push({
          machine_name: machineName,
          weight_lbs: Math.round((set.weight_kg ?? 0) * 2.205),
          improvement_lbs: set.pr_improvement_lbs ?? 0,
        });
      }
    }
  }

  // Machines trained this week
  const machinesTrained = [
    ...new Set(
      sessions
        .map(s => (s.machines as unknown as { name: string } | null)?.name)
        .filter((n): n is string => !!n)
    ),
  ];

  // Average RPE this week
  const allSets = sessions.flatMap(
    s => (s.sets ?? []) as Array<{ rpe?: number | null }>
  );
  const rpeSets = allSets.filter(
    s => s.rpe !== null && s.rpe !== undefined
  );
  const avgRpe =
    rpeSets.length > 0
      ? Math.round(
          (rpeSets.reduce((sum, s) => sum + (s.rpe as number), 0) /
            rpeSets.length) *
            10
        ) / 10
      : null;

  // Readiness averages
  const readinessEntries = readinessData.data ?? [];
  const avgReadiness =
    readinessEntries.length > 0
      ? Math.round(
          readinessEntries.reduce((sum, r) => sum + r.score, 0) /
            readinessEntries.length
        )
      : null;
  const dominantZone = getMostFrequent(
    readinessEntries.map(r => r.zone as string)
  );

  // Muscle analysis from muscle map
  const muscleEntries = Object.entries(muscleMap.states);
  const mostTrained = muscleEntries
    .filter(([, s]) => s.lastTrainedAt !== null)
    .sort(
      ([, a], [, b]) => (a.hoursSinceTraining ?? 999) - (b.hoursSinceTraining ?? 999)
    )
    .slice(0, 3)
    .map(([key]) => {
      const group = MUSCLE_GROUPS.find(g => g.key === key);
      return group?.label ?? key;
    });

  const undertrained = muscleEntries
    .filter(([, s]) => s.state === 'fresh')
    .slice(0, 2)
    .map(([key]) => {
      const group = MUSCLE_GROUPS.find(g => g.key === key);
      return group?.label ?? key;
    });

  const balanceScore = muscleMap.balanceScore;

  // Total volumes
  const totalVolume = sessions.reduce(
    (sum, s) => sum + (s.total_volume_lbs ?? 0),
    0
  );
  const volumeLastWeek = lastSessions.reduce(
    (sum, s) => sum + ((s as { total_volume_lbs?: number }).total_volume_lbs ?? 0),
    0
  );

  // PRs last week
  const prsLastWeek = lastSessions.reduce((count, s) => {
    const sets = ((s as { sets?: unknown[] }).sets ?? []) as Array<{
      is_personal_best?: boolean;
    }>;
    return count + sets.filter(set => set.is_personal_best).length;
  }, 0);

  // Member tenure in months
  const joinedAt = member?.joined_at ? new Date(member.joined_at) : new Date();
  const now = new Date();
  const monthsAsMember = Math.max(
    0,
    (now.getFullYear() - joinedAt.getFullYear()) * 12 +
      (now.getMonth() - joinedAt.getMonth())
  );

  // First name extraction
  const displayName = member?.display_name ?? 'there';
  const firstName = displayName.split(' ')[0];

  return {
    member_id: memberId,
    member_first_name: firstName,
    primary_goal: member?.primary_goal ?? 'general-fitness',
    experience_level: member?.experience_level ?? 'intermediate',
    months_as_member: monthsAsMember,
    program_title:
      (activeProgram.data?.programs as unknown as { name: string } | null)
        ?.name ?? null,
    program_week_number: null, // populated by DNA system later
    week_start: weekStartStr,
    week_end: weekEndStr,
    sessions_this_week: sessions.length,
    sessions_scheduled: null, // populated if on program
    sessions_last_week: lastSessions.length,
    total_volume_lbs: Math.round(totalVolume),
    volume_last_week: Math.round(volumeLastWeek),
    prs_this_week: prDetails.length,
    prs_last_week: prsLastWeek,
    pr_details: prDetails,
    machines_trained: machinesTrained,
    avg_rpe: avgRpe,
    current_streak: member?.current_streak ?? 0,
    avg_readiness_score: avgReadiness,
    dominant_readiness_zone: dominantZone,
    most_trained_muscles: mostTrained,
    undertrained_muscles: undertrained,
    push_pull_balance: balanceScore,
    dna_consistency: dnaConsistency,
    dna_progression: dnaProgression,
    dna_balance: balanceScore,
    dna_trend: dnaTrend,
    injuries_or_limitations: member?.injuries_or_limitations ?? null,
    gym_language: 'en',
    trainer_name: trainerName,
    trainer_id: member?.assigned_trainer_id ?? null,
  };
}

function getMostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const item of arr) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  let maxKey = arr[0];
  let maxCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxKey = key;
      maxCount = count;
    }
  }
  return maxKey;
}
