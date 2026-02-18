import type {
  WorkoutInsight,
  WorkoutExerciseWithSets,
  WorkoutSet,
} from '@smartgym/types';
import { calculateVolume } from '@smartgym/utils';
import { detectPRs } from './prs';

export interface SummaryInput {
  /** Current workout exercises with sets */
  currentExercises: WorkoutExerciseWithSets[];
  /** Previous session exercises (optional, for comparison) */
  previousExercises?: WorkoutExerciseWithSets[];
  /** Historical sets keyed by exercise_name (for PR detection) */
  historicalSets: Map<string, WorkoutSet[]>;
}

/**
 * Generate deterministic workout summary insight.
 */
export function getWorkoutInsight(input: SummaryInput): WorkoutInsight {
  const { currentExercises, previousExercises, historicalSets } = input;

  const allCurrentSets = currentExercises.flatMap((e) => e.sets);
  const totalSets = allCurrentSets.length;
  const totalReps = allCurrentSets.reduce((sum, s) => sum + s.reps, 0);
  const totalVolume = calculateVolume(allCurrentSets);

  // Top exercises by volume
  const volumeByExercise: Record<string, number> = {};
  for (const ex of currentExercises) {
    volumeByExercise[ex.exercise_name] = calculateVolume(ex.sets);
  }
  const topExercises = Object.entries(volumeByExercise)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([exercise_name, volume]) => ({ exercise_name, volume }));

  // PR detection
  const prs = detectPRs({ currentExercises, historicalSets });

  // Comparison with previous session
  let volumeChange: number | null = null;
  let repsChange: number | null = null;
  let weightChange: number | null = null;

  if (previousExercises && previousExercises.length > 0) {
    const prevSets = previousExercises.flatMap((e) => e.sets);
    const prevVolume = calculateVolume(prevSets);
    const prevReps = prevSets.reduce((sum, s) => sum + s.reps, 0);
    const prevMaxWeight = Math.max(...prevSets.map((s) => s.weight_kg), 0);
    const currMaxWeight = Math.max(...allCurrentSets.map((s) => s.weight_kg), 0);

    if (prevVolume > 0) {
      volumeChange = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
    }
    if (prevReps > 0) {
      repsChange = Math.round(((totalReps - prevReps) / prevReps) * 100);
    }
    if (prevMaxWeight > 0) {
      weightChange = Math.round(((currMaxWeight - prevMaxWeight) / prevMaxWeight) * 100);
    }
  }

  // Generate insight text
  const insightText = generateInsightText(
    totalSets,
    totalVolume,
    volumeChange,
    prs.length,
  );

  // Generate next-time suggestion
  const nextTimeSuggestion = generateNextTimeSuggestion(
    volumeChange,
    repsChange,
    prs.length,
    totalSets,
  );

  return {
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume_kg: totalVolume,
    top_exercises_by_volume: topExercises,
    prs,
    volume_change: volumeChange,
    reps_change: repsChange,
    weight_change: weightChange,
    insight_text: insightText,
    next_time_suggestion: nextTimeSuggestion,
  };
}

function generateInsightText(
  totalSets: number,
  totalVolume: number,
  volumeChange: number | null,
  prCount: number,
): string {
  const parts: string[] = [];

  if (prCount > 0) {
    parts.push(
      prCount === 1
        ? 'You hit a new personal record!'
        : `You hit ${prCount} new personal records!`,
    );
  }

  if (volumeChange !== null) {
    if (volumeChange > 0) {
      parts.push(`Volume up ${volumeChange}% vs last session.`);
    } else if (volumeChange < 0) {
      parts.push(
        `Volume down ${Math.abs(volumeChange)}% vs last session — recovery days count too.`,
      );
    } else {
      parts.push('Matched your previous session volume exactly.');
    }
  }

  if (parts.length === 0) {
    if (totalSets === 0) {
      return 'No sets logged this session.';
    }
    return `Solid session — ${totalSets} sets, ${Math.round(totalVolume)} kg total volume. Log 2 sessions to unlock progress insights.`;
  }

  return parts.join(' ');
}

function generateNextTimeSuggestion(
  volumeChange: number | null,
  _repsChange: number | null,
  prCount: number,
  totalSets: number,
): string {
  if (totalSets === 0) {
    return 'Try adding at least one exercise next time.';
  }

  if (prCount > 0) {
    return 'Keep the momentum — try adding one more rep or a small weight bump next session.';
  }

  if (volumeChange !== null && volumeChange > 10) {
    return 'Strong progress! Maintain this load next session before pushing further.';
  }

  if (volumeChange !== null && volumeChange < -10) {
    return 'Focus on recovery. Next session, aim to match your previous numbers.';
  }

  return 'Consistency is key — aim to match or slightly beat these numbers next time.';
}
