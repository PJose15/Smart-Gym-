import type { SupabaseClient } from '@supabase/supabase-js';
import type { MuscleGroupKey, MuscleRecoveryState, MuscleMapResult } from '@nexera/types';
import {
  MUSCLE_GROUPS,
  getMachineMuscleMappings,
  calculateMuscleState,
  buildMuscleRecommendations,
  calculateBalanceScore,
} from '@nexera/ai-assist';

interface MuscleTrainingRecord {
  lastTrainedAt: string;
  rpe: number;
  isPrimary: boolean;
}

/**
 * Build the complete muscle map for a member by querying their last 7 days
 * of sessions and computing recovery state for each of the 17 muscle groups.
 */
export async function buildMemberMuscleMap(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<MuscleMapResult> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  // Get completed sessions from last 7 days with machine info and sets (for RPE)
  const { data: sessions, error: sessionsError } = await admin
    .from('workout_sessions')
    .select(`
      id,
      completed_at,
      sets,
      machines!inner(name, muscle_groups)
    `)
    .eq('member_id', memberId)
    .eq('gym_id', gymId)
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo)
    .order('completed_at', { ascending: false });

  if (sessionsError) {
    console.error('[buildMemberMuscleMap] Query error:', sessionsError.message);
  }

  // Build per-muscle last-trained lookup using the most recent training timestamp
  const muscleLookup: Record<string, MuscleTrainingRecord> = {};

  if (sessions) {
    for (const session of sessions) {
      const completedAt = session.completed_at as string;
      const machine = session.machines as unknown as {
        name: string;
        muscle_groups: string[] | null;
      };

      if (!machine?.name) continue;

      // Parse RPE from sets JSONB array
      const sets = (session.sets ?? []) as Array<{ rpe?: number | null }>;
      const rpes = sets.filter(s => s.rpe != null).map(s => s.rpe as number);
      const avgRpe = rpes.length > 0
        ? rpes.reduce((a, b) => a + b, 0) / rpes.length
        : 7;

      // Use getMachineMuscleMappings for primary/secondary split,
      // falling back to machine.muscle_groups as primary if no mapping found
      const mappings = getMachineMuscleMappings(machine.name);
      const hasMappings = mappings.primary.length > 0 || mappings.secondary.length > 0;
      const primaryMuscles = (hasMappings ? mappings.primary : (machine.muscle_groups ?? [])) as MuscleGroupKey[];
      const secondaryMuscles = (hasMappings ? mappings.secondary : []) as MuscleGroupKey[];

      for (const key of primaryMuscles) {
        if (!muscleLookup[key] || new Date(completedAt) > new Date(muscleLookup[key].lastTrainedAt)) {
          muscleLookup[key] = { lastTrainedAt: completedAt, rpe: avgRpe, isPrimary: true };
        }
      }

      for (const key of secondaryMuscles) {
        if (!muscleLookup[key] || new Date(completedAt) > new Date(muscleLookup[key].lastTrainedAt)) {
          muscleLookup[key] = { lastTrainedAt: completedAt, rpe: avgRpe, isPrimary: false };
        }
      }
    }
  }

  // Calculate state for each of the 17 muscle groups
  const states = {} as Record<MuscleGroupKey, MuscleRecoveryState>;
  for (const group of MUSCLE_GROUPS) {
    const record = muscleLookup[group.key];
    states[group.key] = calculateMuscleState(
      group.key,
      record?.lastTrainedAt ?? null,
      record?.rpe ?? 7,
      record?.isPrimary ?? true,
      now
    );
  }

  const recommendations = buildMuscleRecommendations(states);
  const balanceScore = calculateBalanceScore(states);

  return {
    memberId,
    computedAt: now.toISOString(),
    states,
    recommendations,
    balanceScore,
  };
}
