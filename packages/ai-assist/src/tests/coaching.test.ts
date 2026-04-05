import { describe, it, expect } from 'vitest';
import { buildMemberContext } from '../rules/memberContext';
import { getCoachingInsight } from '../rules/coaching';
import type { MemberContextInput } from '../rules/memberContext';

// ─── Helpers ────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function makeWorkout(
  daysBack: number,
  exercises: Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }>,
) {
  return {
    id: `w-${daysBack}`,
    started_at: daysAgo(daysBack),
    finished_at: new Date(new Date(daysAgo(daysBack)).getTime() + 3600_000).toISOString(),
    exercises: exercises.map((e) => ({
      exercise_name: e.name,
      sets: e.sets,
    })),
  };
}

const emptyFeedback = { discomfort_count: 0, unstable_count: 0, ok_count: 0 };

// ─── buildMemberContext ─────────────────────────────────────

describe('buildMemberContext', () => {
  it('handles no workouts', () => {
    const ctx = buildMemberContext({
      workouts: [],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [],
    });

    expect(ctx.totalWorkouts30d).toBe(0);
    expect(ctx.avgVolumePerSession).toBe(0);
    expect(ctx.volumeTrend).toBe('insufficient');
    expect(ctx.gaps).toContain('No workouts in the last 30 days');
    expect(ctx.risks).toEqual([]);
  });

  it('flags low frequency when < 4 workouts', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(5, [{ name: 'Bench', sets: [{ weight_kg: 60, reps: 10 }] }]),
        makeWorkout(12, [{ name: 'Squat', sets: [{ weight_kg: 80, reps: 8 }] }]),
      ],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [daysAgo(5), daysAgo(12)],
    });

    expect(ctx.totalWorkouts30d).toBe(2);
    expect(ctx.gaps).toContain('Low training frequency (less than once per week)');
  });

  it('computes average volume correctly', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(1, [{ name: 'Bench', sets: [{ weight_kg: 50, reps: 10 }] }]),  // 500
        makeWorkout(3, [{ name: 'Bench', sets: [{ weight_kg: 60, reps: 10 }] }]),  // 600
      ],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [daysAgo(1), daysAgo(3)],
    });

    expect(ctx.avgVolumePerSession).toBe(550);
  });

  it('detects increasing volume trend', () => {
    // 4 workouts: first two low volume, last two high volume
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(28, [{ name: 'Bench', sets: [{ weight_kg: 40, reps: 10 }] }]),
        makeWorkout(21, [{ name: 'Bench', sets: [{ weight_kg: 40, reps: 10 }] }]),
        makeWorkout(14, [{ name: 'Bench', sets: [{ weight_kg: 60, reps: 10 }] }]),
        makeWorkout(7, [{ name: 'Bench', sets: [{ weight_kg: 60, reps: 10 }] }]),
      ],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [daysAgo(28), daysAgo(21), daysAgo(14), daysAgo(7)],
    });

    expect(ctx.volumeTrend).toBe('increasing');
  });

  it('detects decreasing volume trend', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(28, [{ name: 'Bench', sets: [{ weight_kg: 80, reps: 10 }] }]),
        makeWorkout(21, [{ name: 'Bench', sets: [{ weight_kg: 80, reps: 10 }] }]),
        makeWorkout(14, [{ name: 'Bench', sets: [{ weight_kg: 40, reps: 10 }] }]),
        makeWorkout(7, [{ name: 'Bench', sets: [{ weight_kg: 40, reps: 10 }] }]),
      ],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [daysAgo(28), daysAgo(21), daysAgo(14), daysAgo(7)],
    });

    expect(ctx.volumeTrend).toBe('decreasing');
    expect(ctx.gaps).toContain('Volume has been declining recently');
  });

  it('flags high discomfort rate as risk', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(1, [{ name: 'Bench', sets: [{ weight_kg: 50, reps: 10 }] }]),
      ],
      prs: [],
      feedbackTrends: { discomfort_count: 5, unstable_count: 0, ok_count: 10 },
      completedWorkoutDates: [daysAgo(1)],
    });

    expect(ctx.risks).toEqual(
      expect.arrayContaining([expect.stringContaining('discomfort')])
    );
  });

  it('flags high instability rate as risk', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(1, [{ name: 'Bench', sets: [{ weight_kg: 50, reps: 10 }] }]),
      ],
      prs: [],
      feedbackTrends: { discomfort_count: 0, unstable_count: 8, ok_count: 10 },
      completedWorkoutDates: [daysAgo(1)],
    });

    expect(ctx.risks).toEqual(
      expect.arrayContaining([expect.stringContaining('instability')])
    );
  });

  it('flags overtraining when 7+ workouts in a week', () => {
    const workouts = Array.from({ length: 7 }, (_, i) =>
      makeWorkout(i, [{ name: 'Bench', sets: [{ weight_kg: 50, reps: 10 }] }])
    );
    const ctx = buildMemberContext({
      workouts,
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: workouts.map((w) => w.started_at),
    });

    expect(ctx.risks).toEqual(
      expect.arrayContaining([expect.stringContaining('rest days')])
    );
  });

  it('includes PRs in summary', () => {
    const ctx = buildMemberContext({
      workouts: [
        makeWorkout(1, [{ name: 'Bench Press', sets: [{ weight_kg: 100, reps: 5 }] }]),
      ],
      prs: [{ exercise_name: 'Bench Press' }],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [daysAgo(1)],
    });

    expect(ctx.recentPRs).toContain('Bench Press');
    expect(ctx.summaryText).toContain('Bench Press');
  });
});

// ─── getCoachingInsight ─────────────────────────────────────

describe('getCoachingInsight', () => {
  it('returns rules-based insight when no LLM', async () => {
    const insight = await getCoachingInsight({
      memberName: 'John Doe',
      workouts: [],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [],
    });

    expect(insight.source).toBe('rules');
    expect(insight.message).toContain('John');
    expect(insight.action_items.length).toBeGreaterThan(0);
  });

  it('suggests light session for inactive member', async () => {
    const insight = await getCoachingInsight({
      memberName: 'Jane',
      workouts: [],
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: [],
    });

    expect(insight.message).toContain('light session');
  });

  it('celebrates PRs when member has them', async () => {
    const workouts = Array.from({ length: 8 }, (_, i) =>
      makeWorkout(i * 3, [{ name: 'Deadlift', sets: [{ weight_kg: 100, reps: 5 }] }])
    );
    const insight = await getCoachingInsight({
      memberName: 'Alex',
      workouts,
      prs: [{ exercise_name: 'Deadlift' }],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: workouts.map((w) => w.started_at),
    });

    expect(insight.message).toContain('Deadlift');
    expect(insight.source).toBe('rules');
  });

  it('warns about recovery when risks present', async () => {
    // 7 workouts in 7 days to trigger overtraining risk
    const workouts = Array.from({ length: 7 }, (_, i) =>
      makeWorkout(i, [{ name: 'Bench', sets: [{ weight_kg: 50, reps: 10 }] }])
    );
    const insight = await getCoachingInsight({
      memberName: 'Pat',
      workouts,
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: workouts.map((w) => w.started_at),
    });

    expect(insight.message).toContain('recovery');
    expect(insight.action_items).toEqual(
      expect.arrayContaining([expect.stringContaining('rest day')])
    );
  });

  it('gives consistency message for steady trainer', async () => {
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeWorkout(i * 3, [{ name: 'Squat', sets: [{ weight_kg: 70, reps: 8 }] }])
    );
    const insight = await getCoachingInsight({
      memberName: 'Sam',
      workouts,
      prs: [],
      feedbackTrends: emptyFeedback,
      completedWorkoutDates: workouts.map((w) => w.started_at),
    });

    expect(insight.message).toContain('Sam');
    expect(insight.source).toBe('rules');
    expect(insight.action_items.length).toBeGreaterThan(0);
  });
});
