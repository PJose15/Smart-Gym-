import { describe, it, expect } from 'vitest';
import { getNextSetSuggestion } from '../rules/progression';
import type { ProgressionInput } from '../rules/progression';
import type { WorkoutSet } from '@nexera/types';

function makeSet(overrides: Partial<WorkoutSet> & { weight_kg: number; reps: number }): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    workout_exercise_id: 'we-1',
    set_number: 1,
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Session Intent Enforcement', () => {
  const baseSets = [
    makeSet({ set_number: 1, weight_kg: 60, reps: 10, rpe: 7 }),
    makeSet({ set_number: 2, weight_kg: 60, reps: 10, rpe: 7 }),
  ];

  describe('light intent', () => {
    it('caps weight at current — never suggests increase', () => {
      const input: ProgressionInput = {
        currentSets: [
          makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 6 }),
          makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 6 }),
        ],
        previousSets: [],
        goal: 'hypertrophy',
        intent: 'light',
      };
      const result = getNextSetSuggestion(input);
      expect(result.suggested_weight).toBe(60);
      expect(result.should_suggest_increase).toBe(false);
      expect(result.reason_code).toBe('REPEAT_LAST_SET');
    });

    it('includes "Light session" in reason text', () => {
      const result = getNextSetSuggestion({
        currentSets: baseSets,
        previousSets: [],
        intent: 'light',
      });
      expect(result.reason_text).toContain('Light session');
    });

    it('adds a safety note about form', () => {
      const result = getNextSetSuggestion({
        currentSets: baseSets,
        previousSets: [],
        intent: 'light',
      });
      expect(result.safety_note).toBeDefined();
    });
  });

  describe('maintain intent', () => {
    it('skips progressive overload even when criteria met', () => {
      // 2 sets hitting top range with low RPE — normally triggers INCREASE_SMALL
      const input: ProgressionInput = {
        currentSets: [
          makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 6 }),
          makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 6 }),
        ],
        previousSets: [],
        goal: 'hypertrophy',
        intent: 'maintain',
      };
      const result = getNextSetSuggestion(input);
      expect(result.reason_code).toBe('REPEAT_LAST_SET');
      expect(result.should_suggest_increase).toBe(false);
      expect(result.suggested_weight).toBe(60);
    });

    it('still detects fatigue even in maintain mode', () => {
      const input: ProgressionInput = {
        currentSets: [
          makeSet({ set_number: 1, weight_kg: 60, reps: 10, rpe: 7 }),
          makeSet({ set_number: 2, weight_kg: 60, reps: 5, rpe: 9 }), // big rep drop + high RPE
        ],
        previousSets: [],
        intent: 'maintain',
      };
      const result = getNextSetSuggestion(input);
      expect(result.reason_code).toBe('DECREASE_FATIGUE');
    });
  });

  describe('push intent (default)', () => {
    it('behaves like normal — can trigger INCREASE_SMALL', () => {
      const input: ProgressionInput = {
        currentSets: [
          makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 6 }),
          makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 6 }),
        ],
        previousSets: [],
        goal: 'hypertrophy',
        intent: 'push',
      };
      const result = getNextSetSuggestion(input);
      expect(result.reason_code).toBe('INCREASE_SMALL');
      expect(result.should_suggest_increase).toBe(true);
    });

    it('push is the default when intent is omitted', () => {
      const input: ProgressionInput = {
        currentSets: [
          makeSet({ set_number: 1, weight_kg: 60, reps: 12, rpe: 6 }),
          makeSet({ set_number: 2, weight_kg: 60, reps: 12, rpe: 6 }),
        ],
        previousSets: [],
        goal: 'hypertrophy',
      };
      const result = getNextSetSuggestion(input);
      expect(result.reason_code).toBe('INCREASE_SMALL');
    });
  });
});

describe('Beginner Conservatism', () => {
  it('requires 3 sets at top range for overload (not 2)', () => {
    // 2 sets at top range — should NOT trigger for beginner
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 40, reps: 12, rpe: 6 }),
        makeSet({ set_number: 2, weight_kg: 40, reps: 12, rpe: 6 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      experience: 'beginner',
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('REPEAT_LAST_SET');
    expect(result.should_suggest_increase).toBe(false);
  });

  it('triggers overload with 3 sets at top range for beginner', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 40, reps: 12, rpe: 6 }),
        makeSet({ set_number: 2, weight_kg: 40, reps: 12, rpe: 6 }),
        makeSet({ set_number: 3, weight_kg: 40, reps: 12, rpe: 6 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      experience: 'beginner',
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('INCREASE_SMALL');
    expect(result.should_suggest_increase).toBe(true);
  });

  it('intermediate still triggers with 2 sets', () => {
    const input: ProgressionInput = {
      currentSets: [
        makeSet({ set_number: 1, weight_kg: 40, reps: 12, rpe: 6 }),
        makeSet({ set_number: 2, weight_kg: 40, reps: 12, rpe: 6 }),
      ],
      previousSets: [],
      goal: 'hypertrophy',
      experience: 'intermediate',
    };
    const result = getNextSetSuggestion(input);
    expect(result.reason_code).toBe('INCREASE_SMALL');
  });
});

describe('Limitation Safety Notes', () => {
  it('adds safety note for knee_sensitive with squat movement', () => {
    const result = getNextSetSuggestion({
      currentSets: [makeSet({ weight_kg: 60, reps: 10, rpe: 7 })],
      previousSets: [],
      limitations: ['knee_sensitive'],
      movementPattern: 'squat',
    });
    expect(result.safety_note).toContain('knee sensitivity');
  });

  it('adds safety note for shoulder_sensitive with push movement', () => {
    const result = getNextSetSuggestion({
      currentSets: [makeSet({ weight_kg: 60, reps: 10, rpe: 7 })],
      previousSets: [],
      limitations: ['shoulder_sensitive'],
      movementPattern: 'push',
    });
    expect(result.safety_note).toContain('shoulder sensitivity');
  });

  it('does NOT add safety note for non-matching movement', () => {
    const result = getNextSetSuggestion({
      currentSets: [makeSet({ weight_kg: 60, reps: 10, rpe: 7 })],
      previousSets: [],
      limitations: ['knee_sensitive'],
      movementPattern: 'push', // knee doesn't match push
    });
    // Should not have a limitation-specific note (safety_note is undefined when no match)
    expect(result.safety_note).toBeUndefined();
  });

  it('handles multiple limitations — first match wins', () => {
    const result = getNextSetSuggestion({
      currentSets: [makeSet({ weight_kg: 60, reps: 10, rpe: 7 })],
      previousSets: [],
      limitations: ['knee_sensitive', 'back_sensitive'],
      movementPattern: 'hinge', // matches both knee and back
    });
    expect(result.safety_note).toBeDefined();
    expect(result.safety_note).toContain('knee sensitivity');
  });

  it('no safety note when no limitations', () => {
    const result = getNextSetSuggestion({
      currentSets: [makeSet({ weight_kg: 60, reps: 10, rpe: 7 })],
      previousSets: [],
      limitations: [],
      movementPattern: 'squat',
    });
    // safety_note might be undefined or undefined (no limitation match)
    if (result.safety_note) {
      expect(result.safety_note).not.toContain('sensitivity');
    }
  });
});
