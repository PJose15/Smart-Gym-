import { describe, it, expect } from 'vitest';
import { getWorkoutInsight, SummaryInput } from '../rules/summary';
import type { WorkoutExerciseWithSets, WorkoutSet } from '@smartgym/types';

function makeExercise(
  name: string,
  sets: Array<{ weight_kg: number; reps: number }>,
): WorkoutExerciseWithSets {
  return {
    id: `we-${Math.random().toString(36).slice(2)}`,
    workout_id: 'w-1',
    exercise_name: name,
    order_index: 0,
    sets: sets.map((s, i) => ({
      id: `set-${i}`,
      workout_exercise_id: 'we-1',
      set_number: i + 1,
      weight_kg: s.weight_kg,
      reps: s.reps,
      logged_at: new Date().toISOString(),
    })),
  };
}

describe('getWorkoutInsight', () => {
  it('generates insight with basic stats', () => {
    const input: SummaryInput = {
      currentExercises: [
        makeExercise('Bench Press', [
          { weight_kg: 60, reps: 10 },
          { weight_kg: 60, reps: 10 },
          { weight_kg: 60, reps: 8 },
        ]),
      ],
      historicalSets: new Map(),
    };
    const result = getWorkoutInsight(input);
    expect(result.total_sets).toBe(3);
    expect(result.total_reps).toBe(28);
    expect(result.total_volume_kg).toBe(60 * 10 + 60 * 10 + 60 * 8);
    expect(result.top_exercises_by_volume).toHaveLength(1);
    expect(result.insight_text).toBeTruthy();
    expect(result.next_time_suggestion).toBeTruthy();
  });

  it('calculates volume change vs previous session', () => {
    const input: SummaryInput = {
      currentExercises: [
        makeExercise('Squat', [
          { weight_kg: 80, reps: 10 },
          { weight_kg: 80, reps: 10 },
        ]),
      ],
      previousExercises: [
        makeExercise('Squat', [
          { weight_kg: 70, reps: 10 },
          { weight_kg: 70, reps: 10 },
        ]),
      ],
      historicalSets: new Map(),
    };
    const result = getWorkoutInsight(input);
    // Current: 1600, Previous: 1400 → +14.3%
    expect(result.volume_change).toBeGreaterThan(0);
    expect(result.insight_text).toContain('up');
  });

  it('detects PRs', () => {
    const historicalSets = new Map<string, WorkoutSet[]>();
    historicalSets.set('Bench Press', [
      {
        id: 'hist-1',
        workout_exercise_id: 'we-hist',
        set_number: 1,
        weight_kg: 60,
        reps: 10,
        logged_at: new Date().toISOString(),
      },
    ]);

    const input: SummaryInput = {
      currentExercises: [
        makeExercise('Bench Press', [{ weight_kg: 70, reps: 10 }]),
      ],
      historicalSets,
    };
    const result = getWorkoutInsight(input);
    expect(result.prs.length).toBeGreaterThan(0);
    expect(result.prs.some((p) => p.type === 'PR_WEIGHT')).toBe(true);
    expect(result.insight_text).toContain('personal record');
  });

  it('handles empty workout', () => {
    const input: SummaryInput = {
      currentExercises: [],
      historicalSets: new Map(),
    };
    const result = getWorkoutInsight(input);
    expect(result.total_sets).toBe(0);
    expect(result.total_reps).toBe(0);
    expect(result.total_volume_kg).toBe(0);
  });

  it('returns top 3 exercises by volume', () => {
    const input: SummaryInput = {
      currentExercises: [
        makeExercise('Squat', [{ weight_kg: 100, reps: 10 }]),
        makeExercise('Bench', [{ weight_kg: 80, reps: 10 }]),
        makeExercise('Row', [{ weight_kg: 60, reps: 10 }]),
        makeExercise('Curl', [{ weight_kg: 20, reps: 10 }]),
      ],
      historicalSets: new Map(),
    };
    const result = getWorkoutInsight(input);
    expect(result.top_exercises_by_volume).toHaveLength(3);
    expect(result.top_exercises_by_volume[0].exercise_name).toBe('Squat');
  });
});
