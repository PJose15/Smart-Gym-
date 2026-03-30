import type { SupabaseClient } from '@supabase/supabase-js';
import type { DNAResult, DNAScores, DNADimension } from '@nexera/types';
import {
  calculatePowerScore,
  calculateConsistencyScore,
  calculateProgressionScore,
  calculateMindsetScore,
  determineArchetype,
  ARCHETYPES,
} from '@nexera/ai-assist';
import { gatherDNAInputs } from './gatherDNAInputs';

const MIN_SESSIONS = 10;
const MIN_MACHINES = 3;

/**
 * Compute full DNA result for a member.
 * Gathers all inputs from DB, runs all 5 dimension calculators,
 * determines archetype, and fetches history.
 */
export async function computeMemberDNA(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<DNAResult> {
  const inputs = await gatherDNAInputs(memberId, gymId, admin);

  const isBuilding =
    inputs.totalSessionCount < MIN_SESSIONS || inputs.distinctMachineCount < MIN_MACHINES;

  if (isBuilding) {
    return {
      scores: { power: 0, consistency: 0, progression: 0, balance: 0, mindset: 0 },
      previous_scores: null,
      archetype: ARCHETYPES.newcomer,
      previous_archetype: null,
      archetype_changed: false,
      is_building: true,
      sessions_logged: inputs.totalSessionCount,
      distinct_machines: inputs.distinctMachineCount,
      signals: {
        power: {},
        consistency: {},
        progression: {},
        balance: {},
        mindset: {},
      },
      history: [],
      computed_at: new Date().toISOString(),
    };
  }

  // Compute all 5 dimensions
  const power = calculatePowerScore({
    recentSessions: inputs.recentSessions,
    olderSessions: inputs.olderSessions,
  });

  const consistency = calculateConsistencyScore({
    sessionDatesLast30: inputs.sessionDatesLast30,
    currentStreak: inputs.currentStreak,
    bestStreak: inputs.bestStreak,
    readinessEntries: inputs.readinessEntries,
  });

  const progression = calculateProgressionScore({
    allSessions60d: inputs.allSessions60d,
    programs: inputs.programs,
    goals: inputs.goals,
  });

  const mindset = calculateMindsetScore({
    allSets: inputs.allSets,
    checkIns: inputs.checkIns,
    goalsSet: inputs.goalsSet,
    goalsAchieved: inputs.goalsAchieved,
    reactionCount: inputs.reactionCount,
    shareCount: inputs.shareCount,
    sessionCount: inputs.totalSessionCount,
  });

  const scores: DNAScores = {
    power: power.score,
    consistency: consistency.score,
    progression: progression.score,
    balance: inputs.balanceScore,
    mindset: mindset.score,
  };

  const archetype = determineArchetype(scores);

  // Get previous snapshot for comparison
  const { data: previousSnapshot } = await admin
    .from('member_dna_snapshots')
    .select('*')
    .eq('member_id', memberId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousScores: DNAScores | null = previousSnapshot
    ? {
        power: previousSnapshot.power_score,
        consistency: previousSnapshot.consistency_score,
        progression: previousSnapshot.progression_score,
        balance: previousSnapshot.balance_score,
        mindset: previousSnapshot.mindset_score,
      }
    : null;

  const previousArchetype = previousScores ? determineArchetype(previousScores) : null;
  const archetypeChanged = previousArchetype !== null && previousArchetype.id !== archetype.id;

  // Get 12-week history for chart
  const { data: history } = await admin
    .from('member_dna_snapshots')
    .select(
      'snapshot_date, power_score, consistency_score, progression_score, balance_score, mindset_score'
    )
    .eq('member_id', memberId)
    .order('snapshot_date', { ascending: false })
    .limit(12);

  return {
    scores,
    previous_scores: previousScores,
    archetype,
    previous_archetype: previousArchetype,
    archetype_changed: archetypeChanged,
    is_building: false,
    sessions_logged: inputs.totalSessionCount,
    distinct_machines: inputs.distinctMachineCount,
    signals: {
      power: power.signals,
      consistency: consistency.signals,
      progression: progression.signals,
      balance: { balance_score: inputs.balanceScore },
      mindset: mindset.signals,
    } as Record<DNADimension, Record<string, number | string | null>>,
    history: (history ?? []).reverse().map(h => ({
      date: h.snapshot_date,
      scores: {
        power: h.power_score,
        consistency: h.consistency_score,
        progression: h.progression_score,
        balance: h.balance_score,
        mindset: h.mindset_score,
      },
    })),
    computed_at: new Date().toISOString(),
  };
}
