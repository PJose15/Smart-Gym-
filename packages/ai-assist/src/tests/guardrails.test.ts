import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeGuardrails, WorkoutRecord, GuardrailInput } from '../rules/guardrails';
import type { WorkoutSet } from '@nexera/types';

// ─── Helpers ────────────────────────────────────────────

function makeSet(overrides: Partial<WorkoutSet> & { weight_kg: number; reps: number }): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    workout_exercise_id: 'we-1',
    set_number: 1,
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeWorkout(
  overrides: Partial<WorkoutRecord> & { started_at: string },
): WorkoutRecord {
  return {
    id: `w-${Math.random().toString(36).slice(2)}`,
    finished_at: null,
    exercises: [],
    ...overrides,
  };
}

/** Returns ISO date string relative to "now" in ms offset */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Tests ──────────────────────────────────────────────

describe('computeGuardrails', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for no workouts', () => {
    const result = computeGuardrails({
      experience: 'intermediate',
      recentWorkouts: [],
    });
    expect(result).toEqual([]);
  });

  // ──── A) Volume Spike ───────────────────────────────

  describe('volume spike', () => {
    it('detects >25% volume increase for beginner', () => {
      const lastWeekWorkout = makeWorkout({
        started_at: daysAgo(10),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 60, reps: 10 }), // 600
              makeSet({ weight_kg: 60, reps: 10 }), // 600
            ],
          },
        ],
      });
      const thisWeekWorkout = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10 }), // 800
              makeSet({ weight_kg: 80, reps: 10 }), // 800
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'beginner',
        recentWorkouts: [thisWeekWorkout, lastWeekWorkout],
      });

      const volumeInsight = result.find((r) => r.insight_type === 'volume_spike');
      expect(volumeInsight).toBeDefined();
      expect(volumeInsight!.severity).toBe('medium'); // 33% — medium
      expect(volumeInsight!.recommended_action).toBe('deload_light');
    });

    it('flags high severity for >50% spike', () => {
      const lastWeekWorkout = makeWorkout({
        started_at: daysAgo(10),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 40, reps: 10 })], // 400
          },
        ],
      });
      const thisWeekWorkout = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10 }), // 800
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [thisWeekWorkout, lastWeekWorkout],
      });

      const volumeInsight = result.find((r) => r.insight_type === 'volume_spike');
      expect(volumeInsight).toBeDefined();
      expect(volumeInsight!.severity).toBe('high'); // 100% increase
    });

    it('does NOT flag volume spike for advanced users', () => {
      const lastWeekWorkout = makeWorkout({
        started_at: daysAgo(10),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 60, reps: 10 })],
          },
        ],
      });
      const thisWeekWorkout = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 100, reps: 10 })],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'advanced',
        recentWorkouts: [thisWeekWorkout, lastWeekWorkout],
      });

      expect(result.find((r) => r.insight_type === 'volume_spike')).toBeUndefined();
    });

    it('does NOT flag when volume increase is <= 25%', () => {
      const lastWeekWorkout = makeWorkout({
        started_at: daysAgo(10),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 80, reps: 10 })], // 800
          },
        ],
      });
      const thisWeekWorkout = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 90, reps: 10 })], // 900 => 12.5% increase
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'beginner',
        recentWorkouts: [thisWeekWorkout, lastWeekWorkout],
      });

      expect(result.find((r) => r.insight_type === 'volume_spike')).toBeUndefined();
    });
  });

  // ──── B) High RPE Trend ─────────────────────────────

  describe('high RPE trend', () => {
    it('detects >= 3 sets at RPE 9+ in last 2 workouts', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
              makeSet({ weight_kg: 100, reps: 4, rpe: 10 }),
            ],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
              makeSet({ weight_kg: 100, reps: 5, rpe: 7 }),
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1, w2],
      });

      const rpeInsight = result.find((r) => r.insight_type === 'high_rpe');
      expect(rpeInsight).toBeDefined();
      expect(rpeInsight!.severity).toBe('medium'); // 3 sets
      expect(rpeInsight!.recommended_action).toBe('reduce_load');
    });

    it('flags high severity for >= 5 high-RPE sets', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
              makeSet({ weight_kg: 100, reps: 4, rpe: 10 }),
              makeSet({ weight_kg: 100, reps: 3, rpe: 10 }),
            ],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1, w2],
      });

      const rpeInsight = result.find((r) => r.insight_type === 'high_rpe');
      expect(rpeInsight).toBeDefined();
      expect(rpeInsight!.severity).toBe('high');
    });

    it('does NOT flag when fewer than 3 high-RPE sets', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5, rpe: 9 }),
              makeSet({ weight_kg: 100, reps: 5, rpe: 7 }),
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1],
      });

      expect(result.find((r) => r.insight_type === 'high_rpe')).toBeUndefined();
    });

    it('ignores sets without RPE data', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 100, reps: 5 }), // no rpe
              makeSet({ weight_kg: 100, reps: 5 }), // no rpe
              makeSet({ weight_kg: 100, reps: 5 }), // no rpe
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1],
      });

      expect(result.find((r) => r.insight_type === 'high_rpe')).toBeUndefined();
    });
  });

  // ──── C) Rep Collapse ───────────────────────────────

  describe('rep collapse', () => {
    it('detects >30% rep drop repeated across sessions', () => {
      // Two workouts each with a collapse
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
              makeSet({ weight_kg: 80, reps: 6, set_number: 2 }), // 40% drop
            ],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
              makeSet({ weight_kg: 80, reps: 5, set_number: 2 }), // 50% drop
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1, w2],
      });

      const collapseInsight = result.find((r) => r.insight_type === 'rep_collapse');
      expect(collapseInsight).toBeDefined();
      expect(collapseInsight!.recommended_action).toBe('reduce_load');
    });

    it('does NOT flag a single collapse instance', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
              makeSet({ weight_kg: 80, reps: 6, set_number: 2 }), // 40% drop but only 1 instance
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1],
      });

      expect(result.find((r) => r.insight_type === 'rep_collapse')).toBeUndefined();
    });

    it('flags high severity for >= 4 collapse instances', () => {
      const makeCollapseWorkout = (daysBack: number) =>
        makeWorkout({
          started_at: daysAgo(daysBack),
          exercises: [
            {
              exercise_name: 'Bench Press',
              machine_id: null,
              sets: [
                makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
                makeSet({ weight_kg: 80, reps: 5, set_number: 2 }),
              ],
            },
            {
              exercise_name: 'Squat',
              machine_id: null,
              sets: [
                makeSet({ weight_kg: 100, reps: 8, set_number: 1 }),
                makeSet({ weight_kg: 100, reps: 4, set_number: 2 }),
              ],
            },
          ],
        });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [makeCollapseWorkout(1), makeCollapseWorkout(3)],
      });

      const collapseInsight = result.find((r) => r.insight_type === 'rep_collapse');
      expect(collapseInsight).toBeDefined();
      expect(collapseInsight!.severity).toBe('high');
    });

    it('only compares sets at the same weight', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
              makeSet({ weight_kg: 60, reps: 12, set_number: 2 }), // different weight, not collapse
            ],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, set_number: 1 }),
              makeSet({ weight_kg: 60, reps: 12, set_number: 2 }),
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1, w2],
      });

      expect(result.find((r) => r.insight_type === 'rep_collapse')).toBeUndefined();
    });
  });

  // ──── D) Recovery Overlap ───────────────────────────

  describe('recovery overlap', () => {
    it('detects same muscle trained 3 consecutive days', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench Press',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 80, reps: 10 })],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Chest Fly',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 20, reps: 12 })],
          },
        ],
      });
      const w3 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Push Ups',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 0, reps: 20 })],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w3, w2, w1],
      });

      const recoveryInsight = result.find((r) => r.insight_type === 'recovery_overlap');
      expect(recoveryInsight).toBeDefined();
      expect(recoveryInsight!.severity).toBe('medium');
      expect(recoveryInsight!.recommended_action).toBe('rest_day');
      expect((recoveryInsight!.meta as any).muscles).toContain('chest');
    });

    it('does NOT flag non-consecutive days', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(5),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 80, reps: 10 })],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Chest Fly',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 20, reps: 12 })],
          },
        ],
      });
      const w3 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Push Ups',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 0, reps: 20 })],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w3, w2, w1],
      });

      expect(result.find((r) => r.insight_type === 'recovery_overlap')).toBeUndefined();
    });

    it('does NOT flag different muscles on consecutive days', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            primary_muscles: ['chest'],
            sets: [makeSet({ weight_kg: 80, reps: 10 })],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Squat',
            machine_id: null,
            primary_muscles: ['quadriceps'],
            sets: [makeSet({ weight_kg: 100, reps: 8 })],
          },
        ],
      });
      const w3 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Pull Up',
            machine_id: null,
            primary_muscles: ['lats'],
            sets: [makeSet({ weight_kg: 0, reps: 10 })],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w3, w2, w1],
      });

      expect(result.find((r) => r.insight_type === 'recovery_overlap')).toBeUndefined();
    });

    it('handles workouts without primary_muscles gracefully', () => {
      const w1 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 80, reps: 10 })],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Chest Fly',
            machine_id: null,
            sets: [makeSet({ weight_kg: 20, reps: 12 })],
          },
        ],
      });
      const w3 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Push Ups',
            machine_id: null,
            sets: [makeSet({ weight_kg: 0, reps: 20 })],
          },
        ],
      });

      // Should not throw, and should not detect overlap (no primary_muscles)
      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w3, w2, w1],
      });

      expect(result.find((r) => r.insight_type === 'recovery_overlap')).toBeUndefined();
    });
  });

  // ──── Confidence ────────────────────────────────────

  describe('confidence computation', () => {
    it('returns confidence between 0.4 and 0.95', () => {
      // Trigger a volume spike to get a confidence value
      const lastWeekWorkout = makeWorkout({
        started_at: daysAgo(10),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 40, reps: 10 })],
          },
        ],
      });
      const thisWeekWorkout = makeWorkout({
        started_at: daysAgo(2),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [makeSet({ weight_kg: 80, reps: 10 })],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'beginner',
        recentWorkouts: [thisWeekWorkout, lastWeekWorkout],
      });

      for (const insight of result) {
        expect(insight.confidence).toBeGreaterThanOrEqual(0.4);
        expect(insight.confidence).toBeLessThanOrEqual(0.95);
      }
    });

    it('increases confidence with more data points', () => {
      // 2 workouts = lower confidence
      const twoWorkouts = computeGuardrails({
        experience: 'beginner',
        recentWorkouts: [
          makeWorkout({
            started_at: daysAgo(2),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 80, reps: 10 })],
              },
            ],
          }),
          makeWorkout({
            started_at: daysAgo(10),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 40, reps: 10 })],
              },
            ],
          }),
        ],
      });

      // 4 workouts with more data = higher confidence
      const fourWorkouts = computeGuardrails({
        experience: 'beginner',
        recentWorkouts: [
          makeWorkout({
            started_at: daysAgo(1),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 80, reps: 10 })],
              },
            ],
          }),
          makeWorkout({
            started_at: daysAgo(3),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 80, reps: 10 })],
              },
            ],
          }),
          makeWorkout({
            started_at: daysAgo(10),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 40, reps: 10 })],
              },
            ],
          }),
          makeWorkout({
            started_at: daysAgo(12),
            exercises: [
              {
                exercise_name: 'Bench',
                machine_id: null,
                sets: [makeSet({ weight_kg: 40, reps: 10 })],
              },
            ],
          }),
        ],
      });

      const twoConf = twoWorkouts.find((r) => r.insight_type === 'volume_spike')?.confidence ?? 0;
      const fourConf = fourWorkouts.find((r) => r.insight_type === 'volume_spike')?.confidence ?? 0;

      expect(fourConf).toBeGreaterThan(twoConf);
    });
  });

  // ──── Multiple signals ──────────────────────────────

  describe('multiple signals', () => {
    it('can return multiple insights in one call', () => {
      // Trigger both high RPE and rep collapse
      const w1 = makeWorkout({
        started_at: daysAgo(1),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, rpe: 9, set_number: 1 }),
              makeSet({ weight_kg: 80, reps: 5, rpe: 10, set_number: 2 }),
            ],
          },
        ],
      });
      const w2 = makeWorkout({
        started_at: daysAgo(3),
        exercises: [
          {
            exercise_name: 'Bench',
            machine_id: null,
            sets: [
              makeSet({ weight_kg: 80, reps: 10, rpe: 9, set_number: 1 }),
              makeSet({ weight_kg: 80, reps: 5, rpe: 10, set_number: 2 }),
            ],
          },
        ],
      });

      const result = computeGuardrails({
        experience: 'intermediate',
        recentWorkouts: [w1, w2],
      });

      const types = result.map((r) => r.insight_type);
      expect(types).toContain('high_rpe');
      expect(types).toContain('rep_collapse');
    });
  });
});
