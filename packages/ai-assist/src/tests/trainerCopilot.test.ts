import { describe, it, expect } from 'vitest';
import { buildWorkoutDraft } from '../trainerCopilot/buildWorkoutDraft';
import { buildWeeklyDraft } from '../trainerCopilot/buildWeeklyDraft';
import type { WorkoutDraftInput, WeeklyDraftInput } from '../trainerCopilot/types';
import type { PRDetection, GuardrailInsight } from '@nexera/types';

// ─── Helpers ────────────────────────────────────────────

function makeWorkoutInput(overrides: Partial<WorkoutDraftInput> = {}): WorkoutDraftInput {
  return {
    memberName: 'Sam Member',
    exercises: [],
    prs: [],
    volumeChangePct: null,
    totalVolumeKg: 0,
    totalSets: 0,
    totalReps: 0,
    ...overrides,
  };
}

function makeWeeklyInput(overrides: Partial<WeeklyDraftInput> = {}): WeeklyDraftInput {
  return {
    memberName: 'Sam Member',
    workoutsCompleted: 0,
    prCount: 0,
    prSummaries: [],
    activeDays: 0,
    expectedDays: null,
    totalVolumeKg: 0,
    volumeChangePct: null,
    periodStart: '2026-02-20',
    periodEnd: '2026-02-26',
    ...overrides,
  };
}

function makePR(overrides: Partial<PRDetection> = {}): PRDetection {
  return {
    type: 'PR_WEIGHT',
    exercise_name: 'Bench Press',
    value: 100,
    previous_value: 95,
    ...overrides,
  };
}

function makeGuardrail(overrides: Partial<GuardrailInsight> = {}): GuardrailInsight {
  return {
    insight_type: 'volume_spike',
    severity: 'medium',
    confidence: 0.7,
    message: 'Volume jumped 30% this week.',
    recommended_action: 'deload_light',
    ...overrides,
  };
}

// ─── buildWorkoutDraft ──────────────────────────────────

describe('buildWorkoutDraft', () => {
  it('generates a draft with acknowledgement for any workout', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 12,
      totalVolumeKg: 5000,
    }));

    expect(result.draft_title).toBeTruthy();
    expect(result.draft_body).toContain('Sam Member');
    expect(result.draft_body).toContain('12 sets');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.signals).toBeDefined();
  });

  it('highlights PR when present', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      prs: [makePR({ exercise_name: 'Bench Press', type: 'PR_WEIGHT', value: 100 })],
    }));

    expect(result.draft_title).toContain('PR');
    expect(result.draft_body).toContain('Bench Press');
    expect(result.signals.prs).toHaveLength(1);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('handles no PR by showing volume highlight', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      volumeChangePct: 15,
    }));

    expect(result.draft_title).not.toContain('PR');
    expect(result.draft_body).toContain('Volume up 15%');
  });

  it('includes correction when guardrail triggered', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      guardrails: [makeGuardrail({ insight_type: 'volume_spike' })],
    }));

    expect(result.draft_title).toContain('watch');
    expect(result.draft_body).toContain('easing');
    expect(result.signals.guardrails).toHaveLength(1);
  });

  it('uses goal-specific correction when no guardrails', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      goal: 'strength',
    }));

    expect(result.draft_body).toContain('heavier loads');
  });

  it('includes next session direction', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
    }));

    expect(result.draft_body).toContain('Next session');
  });

  it('returns low confidence for minimal data', () => {
    const result = buildWorkoutDraft(makeWorkoutInput());

    expect(result.confidence).toBeLessThanOrEqual(0.45);
  });

  it('returns high confidence with full data', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 12,
      totalVolumeKg: 6000,
      totalReps: 100,
      volumeChangePct: 5,
      prs: [makePR()],
      guardrails: [makeGuardrail()],
      goal: 'hypertrophy',
      experience: 'intermediate',
    }));

    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('uses lbs unit label when specified', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      units: 'lbs',
    }));

    expect(result.draft_body).toContain('lbs');
  });

  it('suggests consolidation after PR', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      prs: [makePR()],
    }));

    expect(result.draft_body).toContain('consolidation');
  });

  it('suggests going easier when guardrails present', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 8,
      totalVolumeKg: 4000,
      guardrails: [makeGuardrail()],
    }));

    expect(result.draft_body).toContain('easier');
  });

  it('includes all expected signal fields', () => {
    const result = buildWorkoutDraft(makeWorkoutInput({
      totalSets: 10,
      totalReps: 80,
      totalVolumeKg: 5000,
      goal: 'hypertrophy',
      experience: 'beginner',
    }));

    expect(result.signals.total_sets).toBe(10);
    expect(result.signals.total_reps).toBe(80);
    expect(result.signals.total_volume_kg).toBe(5000);
    expect(result.signals.goal).toBe('hypertrophy');
    expect(result.signals.experience).toBe('beginner');
  });
});

// ─── buildWeeklyDraft ───────────────────────────────────

describe('buildWeeklyDraft', () => {
  it('generates a draft for a week with workouts', () => {
    const result = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 3,
      activeDays: 3,
    }));

    expect(result.draft_title).toContain('solid week');
    expect(result.draft_body).toContain('Sam Member');
    expect(result.draft_body).toContain('3 workouts');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('generates check-in for zero workout weeks', () => {
    const result = buildWeeklyDraft(makeWeeklyInput());

    expect(result.draft_title).toContain('reconnect');
    expect(result.draft_body).toContain("didn't log");
    expect(result.draft_body).toContain('lighter session');
  });

  it('highlights PRs in weekly recap', () => {
    const result = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 4,
      activeDays: 4,
      prCount: 2,
      prSummaries: [
        { exercise: 'Bench', type: 'PR_WEIGHT', value: 100 },
        { exercise: 'Squat', type: 'PR_REPS', value: 8 },
      ],
    }));

    expect(result.draft_title).toContain('PR');
    expect(result.draft_body).toContain('2 new personal records');
  });

  it('includes guardrail correction in weekly draft', () => {
    const result = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 3,
      activeDays: 3,
      guardrails: [makeGuardrail({ insight_type: 'high_rpe' })],
    }));

    expect(result.draft_body).toContain('lighter session');
  });

  it('shows consistency highlight for 4+ sessions', () => {
    const result = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 4,
      activeDays: 4,
    }));

    expect(result.draft_body).toContain('excellent commitment');
  });

  it('returns proper signals for weekly draft', () => {
    const result = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 3,
      activeDays: 3,
      goal: 'strength',
      experience: 'advanced',
    }));

    expect(result.signals.workouts_in_period).toBe(3);
    expect(result.signals.streak_days).toBe(3);
    expect(result.signals.goal).toBe('strength');
    expect(result.signals.experience).toBe('advanced');
  });

  it('returns low confidence for zero-workout week', () => {
    const result = buildWeeklyDraft(makeWeeklyInput());

    expect(result.confidence).toBeLessThanOrEqual(0.45);
  });

  it('returns higher confidence with more data', () => {
    const resultFull = buildWeeklyDraft(makeWeeklyInput({
      workoutsCompleted: 5,
      activeDays: 5,
      prCount: 1,
      prSummaries: [{ exercise: 'Bench', type: 'PR_WEIGHT', value: 100 }],
      volumeChangePct: 5,
      goal: 'hypertrophy',
      expectedDays: 4,
      guardrails: [makeGuardrail()],
    }));

    const resultMinimal = buildWeeklyDraft(makeWeeklyInput());

    expect(resultFull.confidence).toBeGreaterThan(resultMinimal.confidence);
  });
});
