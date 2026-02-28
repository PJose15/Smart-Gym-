/**
 * Plan Integrity Guardrails — detect fatigue/volume spikes
 * and generate safe training nudges. Fully deterministic.
 *
 * Signals:
 * A) Volume spike: >25% weekly increase for beginner/intermediate
 * B) High RPE trend: >=3 sets at RPE>=9 in last 2 workouts
 * C) Rep collapse: >30% rep drop across sets, repeated across sessions
 * D) Recovery overlap: same muscle group trained hard 3 days in a row
 */

import type {
  GuardrailInsight,
  GuardrailType,
  GuardrailSeverity,
  GuardrailAction,
  WorkoutSet,
  ExperienceLevel,
} from '@smartgym/types';

// ─── Input Types ────────────────────────────────────────

export interface WorkoutRecord {
  id: string;
  started_at: string;
  finished_at: string | null;
  exercises: Array<{
    exercise_name: string;
    machine_id: string | null;
    /** Primary muscles targeted (from machine metadata) */
    primary_muscles?: string[];
    sets: WorkoutSet[];
  }>;
}

export interface GuardrailInput {
  /** User's experience level */
  experience: ExperienceLevel;
  /** Recent workouts, newest first (ideally last 14 days) */
  recentWorkouts: WorkoutRecord[];
}

// ─── Constants ──────────────────────────────────────────

const VOLUME_SPIKE_THRESHOLD = 0.25; // 25%
const HIGH_RPE = 9;
const HIGH_RPE_SET_THRESHOLD = 3;
const REP_COLLAPSE_THRESHOLD = 0.30; // 30%
const RECOVERY_CONSECUTIVE_DAYS = 3;

// ─── Engine ─────────────────────────────────────────────

export function computeGuardrails(input: GuardrailInput): GuardrailInsight[] {
  const { experience, recentWorkouts } = input;
  const insights: GuardrailInsight[] = [];

  if (recentWorkouts.length === 0) return insights;

  // A) Volume spike
  const volumeInsight = checkVolumeSpikeInsight(recentWorkouts, experience);
  if (volumeInsight) insights.push(volumeInsight);

  // B) High RPE trend
  const rpeInsight = checkHighRpeTrend(recentWorkouts);
  if (rpeInsight) insights.push(rpeInsight);

  // C) Rep collapse trend
  const repCollapseInsight = checkRepCollapse(recentWorkouts);
  if (repCollapseInsight) insights.push(repCollapseInsight);

  // D) Recovery overlap
  const recoveryInsight = checkRecoveryOverlap(recentWorkouts);
  if (recoveryInsight) insights.push(recoveryInsight);

  return insights;
}

// ─── A) Volume Spike ────────────────────────────────────

function checkVolumeSpikeInsight(
  workouts: WorkoutRecord[],
  experience: ExperienceLevel,
): GuardrailInsight | null {
  // Only flag for beginner/intermediate
  if (experience === 'advanced') return null;

  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const thisWeek = workouts.filter((w) => {
    const t = new Date(w.started_at).getTime();
    return now - t <= oneWeekMs;
  });

  const lastWeek = workouts.filter((w) => {
    const t = new Date(w.started_at).getTime();
    return now - t > oneWeekMs && now - t <= 2 * oneWeekMs;
  });

  if (lastWeek.length === 0) return null; // Not enough history

  const thisVolume = sumVolume(thisWeek);
  const lastVolume = sumVolume(lastWeek);

  if (lastVolume === 0) return null;

  const change = (thisVolume - lastVolume) / lastVolume;

  if (change > VOLUME_SPIKE_THRESHOLD) {
    const pct = Math.round(change * 100);
    const severity: GuardrailSeverity = pct > 50 ? 'high' : 'medium';
    const confidence = computeConfidence(thisWeek.length + lastWeek.length);

    return {
      insight_type: 'volume_spike',
      severity,
      confidence,
      message: `Your training volume jumped ${pct}% this week. Consider a lighter session to let your body adapt.`,
      recommended_action: 'deload_light',
      meta: { this_week_volume: thisVolume, last_week_volume: lastVolume, change_pct: pct },
    };
  }

  return null;
}

// ─── B) High RPE Trend ─────────────────────────────────

function checkHighRpeTrend(workouts: WorkoutRecord[]): GuardrailInsight | null {
  // Look at last 2 workouts
  const recent = workouts.slice(0, 2);
  if (recent.length === 0) return null;

  let highRpeSets = 0;
  let totalSetsWithRpe = 0;

  for (const w of recent) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (set.rpe != null) {
          totalSetsWithRpe++;
          if (set.rpe >= HIGH_RPE) {
            highRpeSets++;
          }
        }
      }
    }
  }

  if (totalSetsWithRpe === 0) return null; // No RPE data

  if (highRpeSets >= HIGH_RPE_SET_THRESHOLD) {
    const confidence = computeConfidence(totalSetsWithRpe);

    return {
      insight_type: 'high_rpe',
      severity: highRpeSets >= 5 ? 'high' : 'medium',
      confidence,
      message: `${highRpeSets} sets at RPE ${HIGH_RPE}+ in your recent workouts. Consider reducing intensity to avoid burnout.`,
      recommended_action: 'reduce_load',
      meta: { high_rpe_sets: highRpeSets, total_sets_with_rpe: totalSetsWithRpe },
    };
  }

  return null;
}

// ─── C) Rep Collapse Trend ──────────────────────────────

function checkRepCollapse(workouts: WorkoutRecord[]): GuardrailInsight | null {
  // Look for repeated rep collapse within an exercise across sessions
  const recent = workouts.slice(0, 3);
  let collapseCount = 0;

  for (const w of recent) {
    for (const ex of w.exercises) {
      if (ex.sets.length < 2) continue;

      // Group sets by weight to compare reps at same weight
      const setsAtWeight = new Map<number, WorkoutSet[]>();
      for (const set of ex.sets) {
        if (set.weight_kg > 0) {
          const existing = setsAtWeight.get(set.weight_kg) ?? [];
          existing.push(set);
          setsAtWeight.set(set.weight_kg, existing);
        }
      }

      for (const [, sets] of setsAtWeight) {
        if (sets.length < 2) continue;
        const firstReps = sets[0].reps;
        const lastReps = sets[sets.length - 1].reps;
        if (firstReps > 0 && (firstReps - lastReps) / firstReps > REP_COLLAPSE_THRESHOLD) {
          collapseCount++;
        }
      }
    }
  }

  if (collapseCount >= 2) {
    return {
      insight_type: 'rep_collapse',
      severity: collapseCount >= 4 ? 'high' : 'medium',
      confidence: computeConfidence(recent.length * 3),
      message: 'Your reps are dropping significantly across sets in multiple exercises. Consider reducing weight or adding more rest between sets.',
      recommended_action: 'reduce_load',
      meta: { collapse_instances: collapseCount },
    };
  }

  return null;
}

// ─── D) Recovery Overlap ────────────────────────────────

function checkRecoveryOverlap(workouts: WorkoutRecord[]): GuardrailInsight | null {
  // Check if same muscle group trained hard on 3 consecutive days
  const dayBuckets = new Map<string, Set<string>>();

  for (const w of workouts) {
    const date = new Date(w.started_at).toISOString().slice(0, 10); // YYYY-MM-DD
    const muscles = dayBuckets.get(date) ?? new Set<string>();

    for (const ex of w.exercises) {
      const primaryMuscles = ex.primary_muscles ?? [];
      for (const m of primaryMuscles) {
        muscles.add(m.toLowerCase());
      }
    }

    dayBuckets.set(date, muscles);
  }

  const sortedDays = [...dayBuckets.keys()].sort();

  for (let i = 0; i <= sortedDays.length - RECOVERY_CONSECUTIVE_DAYS; i++) {
    const days = sortedDays.slice(i, i + RECOVERY_CONSECUTIVE_DAYS);

    // Check if days are actually consecutive
    if (!areConsecutiveDays(days)) continue;

    // Find muscles common to all days
    const muscleSets = days.map((d) => dayBuckets.get(d)!);
    const commonMuscles = intersectSets(muscleSets);

    if (commonMuscles.size > 0) {
      return {
        insight_type: 'recovery_overlap',
        severity: 'medium',
        confidence: computeConfidence(days.length * 2),
        message: `You've trained ${[...commonMuscles].join(', ')} for ${RECOVERY_CONSECUTIVE_DAYS} days in a row. Consider a rest day or switching muscle groups.`,
        recommended_action: 'rest_day',
        meta: { muscles: [...commonMuscles], consecutive_days: days },
      };
    }
  }

  return null;
}

// ─── Helpers ────────────────────────────────────────────

function sumVolume(workouts: WorkoutRecord[]): number {
  let total = 0;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        total += set.weight_kg * set.reps;
      }
    }
  }
  return total;
}

function computeConfidence(dataPoints: number): number {
  // More data = higher confidence, capped at 0.95
  const base = 0.4;
  const bonus = Math.min(dataPoints * 0.05, 0.55);
  return Math.min(base + bonus, 0.95);
}

function areConsecutiveDays(days: string[]): boolean {
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (Math.round(diffDays) !== 1) return false;
  }
  return true;
}

function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    for (const item of result) {
      if (!sets[i].has(item)) {
        result.delete(item);
      }
    }
  }
  return result;
}
