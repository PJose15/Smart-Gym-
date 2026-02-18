import { describe, it, expect } from 'vitest';
import { getNextSetSuggestion, ProgressionInput } from '../rules/progression';
import type { WorkoutSet } from '@smartgym/types';

function makeSet(overrides: Partial<WorkoutSet> & { weight_kg: number; reps: number }): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    workout_exercise_id: 'we-1',
    set_number: 1,
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getNextSetSuggestion', () => {
  it('returns INSUFFICIENT_DATA when no sets exist', () => {
    const result = getNextSetSuggestion({
      currentSets: [],
      previousSets: [],
    });
    expect(result.reason_code).toBe('INSUFFICIENT_DATA');
    expect(result.suggested_weight).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.should_suggest_increase).toBe(false);
  });

  it('suggests repeating last set (REPEAT_LAST_SET)', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 60, reps: 10, rpe: 7 }),
      ],
      previousSets: [],
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('REPEAT_LAST_SET');
    expect(result.suggested_weight).toBe(60);
    expect(result.suggested_reps).toBe(10);
    expect(result.should_suggest_increase).toBe(false);
  });

  it('suggests small increase when hitting top of rep range at low RPE (INCREASE_SMALL)', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 7 }),
        makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 7 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      unit: 'kg',
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('INCREASE_SMALL');
    expect(result.suggested_weight).toBeGreaterThan(60);
    expect(result.should_suggest_increase).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('suggests decrease when RPE is high (DECREASE_FATIGUE)', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 80, reps: 8, rpe: 9 }),
        makeSet({ set_number: 2, weight_kg: 80, reps: 5, rpe: 9 }),
      ],
      previousSets: [],
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('DECREASE_FATIGUE');
    expect(result.should_suggest_increase).toBe(false);
  });

  it('suggests decrease when reps drop >30% (DECREASE_FATIGUE)', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 80, reps: 10 }),
        makeSet({ set_number: 2, weight_kg: 80, reps: 6 }),  // 40% drop
      ],
      previousSets: [],
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('DECREASE_FATIGUE');
    expect(result.suggested_weight).toBeLessThanOrEqual(80);
    expect(result.should_suggest_increase).toBe(false);
  });

  it('returns REPS_ONLY when weight is 0 (bodyweight)', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 0, reps: 15 }),
      ],
      previousSets: [],
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('REPS_ONLY');
    expect(result.suggested_weight).toBeNull();
    expect(result.suggested_reps).toBeGreaterThan(0);
  });

  it('never suggests >10% weight jump within same session', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 20, reps: 12, rpe: 6 }),
        makeSet({ set_number: 2, weight_kg: 20, reps: 12, rpe: 6 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      unit: 'kg',
    };
    const result = getNextSetSuggestion(input);
    if (result.suggested_weight !== null) {
      const jumpPercent = (result.suggested_weight - 20) / 20;
      expect(jumpPercent).toBeLessThanOrEqual(0.10);
    }
  });

  it('suggests previous session weight for new machine baseline', () => {
    const input: ProgressionInput = {
      currentSets: [],
      previousSets: [
        makeSet({ set_number: 1, weight_kg: 50, reps: 10 }),
        makeSet({ set_number: 2, weight_kg: 50, reps: 10 }),
      ],
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('NEW_MACHINE_BASELINE');
    expect(result.suggested_weight).toBe(50);
    expect(result.suggested_reps).toBe(10);
  });

  it('works with lbs unit', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 7 }),
        makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 7 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      unit: 'lbs',
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('INCREASE_SMALL');
    expect(result.reason_text).toContain('lbs');
  });

  it('uses strength rep ranges when goal is strength', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 100, reps: 6, rpe: 7 }),
        makeSet({ set_number: 2, weight_kg: 100, reps: 6, rpe: 7 }),
      ],
      previousSets: [],
      goal: 'strength',
      unit: 'kg',
    };
    const result = getNextSetSuggestion(input);
    // 6 is top of strength range (3-6), should suggest increase
    expect(result.reason_code).toBe('INCREASE_SMALL');
    expect(result.should_suggest_increase).toBe(true);
  });
});
