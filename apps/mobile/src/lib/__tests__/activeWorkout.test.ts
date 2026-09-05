/**
 * Unit tests for the pure activeWorkout helpers.
 * (supabase is globally mocked in jest.setup.js; resolveWorkoutIdentity's
 * network path is exercised via the mocked client.)
 */
import {
  MAX_WEIGHT,
  aggregateDay,
  consumeCompletionResults,
  consumePrResults,
  sessionSetsToKg,
  stashCompletionResults,
  stashPrResult,
  toApiWorkoutMode,
  validateSetInput,
} from '../activeWorkout';
import type { CompleteSessionResult, PrResult, SessionSetEntry } from '../sessionApi';

function makeSet(overrides: Partial<SessionSetEntry> = {}): SessionSetEntry {
  return {
    set_number: 1,
    weight_lbs: 100,
    reps: 10,
    rpe: null,
    notes: null,
    logged_at: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

describe('toApiWorkoutMode', () => {
  it('maps context modes to the sessions API enum', () => {
    expect(toApiWorkoutMode('ai-program')).toBe('ai_program');
    expect(toApiWorkoutMode('trainer-program')).toBe('trainer_program');
    expect(toApiWorkoutMode('freestyle')).toBe('free');
  });
});

describe('validateSetInput', () => {
  it('accepts a normal lbs set', () => {
    expect(validateSetInput(135, 'lbs', 8)).toBeNull();
  });

  it('accepts a normal kg set with rpe', () => {
    expect(validateSetInput(60, 'kg', 10, 8)).toBeNull();
  });

  it('accepts bodyweight (0) sets', () => {
    expect(validateSetInput(0, 'lbs', 12)).toBeNull();
  });

  it('rejects negative or NaN weight', () => {
    expect(validateSetInput(-5, 'lbs', 8)).toMatch(/Weight/);
    expect(validateSetInput(NaN, 'lbs', 8)).toMatch(/Weight/);
  });

  it('enforces per-unit weight caps', () => {
    expect(MAX_WEIGHT.lbs).toBe(1500);
    expect(MAX_WEIGHT.kg).toBe(700);
    expect(validateSetInput(1500, 'lbs', 5)).toBeNull();
    expect(validateSetInput(1501, 'lbs', 5)).toMatch(/1500 lbs/);
    expect(validateSetInput(700, 'kg', 5)).toBeNull();
    expect(validateSetInput(701, 'kg', 5)).toMatch(/700 kg/);
  });

  it('rejects invalid reps', () => {
    expect(validateSetInput(100, 'lbs', 0)).toMatch(/Reps/);
    expect(validateSetInput(100, 'lbs', -1)).toMatch(/Reps/);
    expect(validateSetInput(100, 'lbs', 2.5)).toMatch(/Reps/);
    expect(validateSetInput(100, 'lbs', NaN)).toMatch(/Reps/);
    expect(validateSetInput(100, 'lbs', 1000)).toMatch(/999/);
    expect(validateSetInput(100, 'lbs', 999)).toBeNull();
  });

  it('validates rpe range only when provided', () => {
    expect(validateSetInput(100, 'lbs', 8, undefined)).toBeNull();
    expect(validateSetInput(100, 'lbs', 8, null)).toBeNull();
    expect(validateSetInput(100, 'lbs', 8, 1)).toBeNull();
    expect(validateSetInput(100, 'lbs', 8, 10)).toBeNull();
    expect(validateSetInput(100, 'lbs', 8, 0)).toMatch(/RPE/);
    expect(validateSetInput(100, 'lbs', 8, 11)).toMatch(/RPE/);
    expect(validateSetInput(100, 'lbs', 8, NaN)).toMatch(/RPE/);
  });
});

describe('aggregateDay', () => {
  it('returns zeros for an empty day', () => {
    expect(aggregateDay([])).toEqual({
      sessions: 0,
      sets: 0,
      volumeLbs: 0,
      bestWeightLbs: 0,
    });
  });

  it('sums sets_count, volume, and takes max best weight', () => {
    const agg = aggregateDay([
      { sets: null, sets_count: 3, total_volume_lbs: 3000, best_weight_lbs: 185 },
      { sets: null, sets_count: 4, total_volume_lbs: 2400, best_weight_lbs: 120 },
    ]);
    expect(agg).toEqual({
      sessions: 2,
      sets: 7,
      volumeLbs: 5400,
      bestWeightLbs: 185,
    });
  });

  it('falls back to sets JSONB length when sets_count is missing', () => {
    const agg = aggregateDay([
      {
        sets: [makeSet(), makeSet({ set_number: 2 })],
        total_volume_lbs: null,
        best_weight_lbs: null,
      },
    ]);
    expect(agg.sets).toBe(2);
    expect(agg.volumeLbs).toBe(0);
    expect(agg.bestWeightLbs).toBe(0);
  });
});

describe('sessionSetsToKg', () => {
  it('converts weight_lbs to weight_kg with the exact factor', () => {
    const [converted] = sessionSetsToKg([makeSet({ weight_lbs: 100 })]);
    expect(converted.weight_kg).toBeCloseTo(45.359237, 5);
  });

  it('preserves set_number, reps, rpe, and logged_at', () => {
    const [converted] = sessionSetsToKg([
      makeSet({ set_number: 3, reps: 6, rpe: 9, logged_at: '2026-09-04T11:30:00Z' }),
    ]);
    expect(converted.set_number).toBe(3);
    expect(converted.reps).toBe(6);
    expect(converted.rpe).toBe(9);
    expect(converted.logged_at).toBe('2026-09-04T11:30:00Z');
    expect(converted.id).toBe('session-set-3');
  });

  it('handles empty input', () => {
    expect(sessionSetsToKg([])).toEqual([]);
  });
});

describe('completion handoff store', () => {
  const result: CompleteSessionResult = {
    success: true,
    summary: {
      session_id: 's1',
      sets_count: 3,
      total_volume_lbs: 3000,
      best_weight_lbs: 185,
      is_personal_best: true,
      points_awarded: 60,
      streak: 4,
    },
  };
  const pr: PrResult = {
    type: 'weight',
    value: 185,
    previousValue: 175,
    improvementPct: 5.7,
  };

  it('stash + consume returns results exactly once', () => {
    stashCompletionResults([result]);
    expect(consumeCompletionResults()).toEqual([result]);
    expect(consumeCompletionResults()).toBeNull();
  });

  it('accumulates PRs and clears on consume', () => {
    stashPrResult(pr);
    stashPrResult({ ...pr, type: 'volume', value: 3000 });
    const prs = consumePrResults();
    expect(prs).toHaveLength(2);
    expect(prs[0].type).toBe('weight');
    expect(prs[1].type).toBe('volume');
    expect(consumePrResults()).toEqual([]);
  });
});
