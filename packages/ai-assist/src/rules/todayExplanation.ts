import type {
  TodayExplanation,
  ProgramDay,
  ProgramExercise,
  UserGoal,
} from '@nexera/types';
import type { LLMProvider } from '../providers/llmProvider';

// ─── Inputs ─────────────────────────────────────────────

export interface TodayExplanationInput {
  /** Which program day the user is on */
  programDay: ProgramDay;
  /** Exercises assigned for that day */
  exercises: ProgramExercise[];
  /** User's training goal */
  goal?: UserGoal;
  /** Map of muscle → days since last workout (for gap text) */
  lastMuscleWorkouts?: Record<string, number>;
  /** Optional LLM provider to rewrite the reasoning text */
  rewriteReasoning?: LLMProvider;
}

// ─── Goal labels ────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  strength: 'building strength',
  hypertrophy: 'muscle growth',
  endurance: 'muscular endurance',
  general: 'general fitness',
};

// ─── Engine ─────────────────────────────────────────────

export async function getTodayExplanation(
  input: TodayExplanationInput,
): Promise<TodayExplanation> {
  const {
    programDay,
    exercises,
    goal = 'general',
    lastMuscleWorkouts,
    rewriteReasoning,
  } = input;

  // Collect all target muscles from exercise names (simplified)
  const muscleGroups = new Set<string>();
  for (const ex of exercises) {
    // Use exercise name words as rough muscle proxy
    const words = ex.exercise_name.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (MUSCLE_KEYWORDS.has(w)) {
        muscleGroups.add(w);
      }
    }
  }

  const muscleList =
    muscleGroups.size > 0
      ? Array.from(muscleGroups).join(', ')
      : 'multiple muscle groups';

  const goalLabel = GOAL_LABELS[goal] || 'general fitness';

  // Build gap text
  let gapText: string | undefined;
  if (lastMuscleWorkouts && Object.keys(lastMuscleWorkouts).length > 0) {
    const gaps = Object.entries(lastMuscleWorkouts)
      .filter(([, days]) => days > 0)
      .sort(([, a], [, b]) => b - a);

    if (gaps.length > 0) {
      const parts = gaps.slice(0, 3).map(([muscle, days]) =>
        `${muscle} (${days}d ago)`,
      );
      gapText = `Last trained: ${parts.join(', ')}`;
    }
  }

  // Build reasoning
  let reasoning = `Day ${programDay.day_number} focuses on ${muscleList}. `
    + `This aligns with your ${goalLabel} goal. `
    + `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} planned.`;

  // Optionally rewrite with LLM
  if (rewriteReasoning) {
    try {
      const rewritten = await rewriteReasoning.rewriteInsightText({
        insightText: reasoning,
        suggestionText: '',
      });
      if (rewritten && rewritten.insightText.length > 0) {
        reasoning = rewritten.insightText;
      }
    } catch {
      // Fall back to rule-based reasoning
    }
  }

  return {
    day_label: programDay.name,
    exercise_count: exercises.length,
    focus_muscles: Array.from(muscleGroups),
    reasoning,
    last_workout_gap_text: gapText ?? null,
  };
}

// ─── Muscle keyword set ─────────────────────────────────

const MUSCLE_KEYWORDS = new Set([
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'biceps',
  'triceps',
  'core',
  'abs',
  'glutes',
  'hamstrings',
  'quads',
  'calves',
  'lats',
  'traps',
  'deltoids',
  'forearms',
]);
