import { describe, it, expect } from 'vitest';
import { computeGuardrails } from '../rules/guardrails';
import type { GuardrailInput, WorkoutRecord } from '../rules/guardrails';
import type { WorkoutSet, GuardrailAcknowledgement } from '@smartgym/types';

function makeSet(overrides: Partial<WorkoutSet> & { weight_kg: number; reps: number }): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    workout_exercise_id: 'we-1',
    set_number: 1,
    rpe: null,
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeWorkout(
  id: string,
  daysAgo: number,
  exercises: WorkoutRecord['exercises'],
): WorkoutRecord {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    started_at: d.toISOString(),
    finished_at: d.toISOString(),
    exercises,
  };
}

function makeAck(
  type: string,
  severity: string,
  hoursAgo: number,
): GuardrailAcknowledgement {
  const d = new Date();
  d.setTime(d.getTime() - hoursAgo * 60 * 60 * 1000);
  return {
    id: `ack-${Math.random().toString(36).slice(2)}`,
    gym_id: 'gym-1',
    profile_id: 'profile-1',
    insight_type: type as GuardrailAcknowledgement['insight_type'],
    severity: severity as GuardrailAcknowledgement['severity'],
    acknowledged_at: d.toISOString(),
  };
}

// Build workouts that trigger a volume spike
function buildVolumeSpikeWorkouts(changePct: number): WorkoutRecord[] {
  const baseVolume = 1000;
  const thisWeekVolume = baseVolume * (1 + changePct / 100);

  return [
    makeWorkout('w1', 1, [{
      exercise_name: 'Bench Press',
      machine_id: 'm1',
      sets: [makeSet({ weight_kg: thisWeekVolume / 10, reps: 10 })],
    }]),
    makeWorkout('w2', 10, [{
      exercise_name: 'Bench Press',
      machine_id: 'm1',
      sets: [makeSet({ weight_kg: baseVolume / 10, reps: 10 })],
    }]),
  ];
}

describe('Guardrail Cooldown / Dedup', () => {
  it('suppresses guardrail when same type acknowledged <24h ago at same severity', () => {
    const workouts = buildVolumeSpikeWorkouts(30); // triggers medium volume_spike
    const acks = [makeAck('volume_spike', 'medium', 12)]; // ack'd 12h ago at medium

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
      recentAcknowledgements: acks,
    });

    // volume_spike should be suppressed (ack severity >= insight severity)
    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeUndefined();
  });

  it('suppresses guardrail when ack severity is HIGHER than current', () => {
    const workouts = buildVolumeSpikeWorkouts(30); // medium volume_spike
    const acks = [makeAck('volume_spike', 'high', 6)]; // ack'd at high

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
      recentAcknowledgements: acks,
    });

    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeUndefined();
  });

  it('keeps guardrail when severity ESCALATED beyond ack', () => {
    const workouts = buildVolumeSpikeWorkouts(50); // high volume_spike
    const acks = [makeAck('volume_spike', 'low', 6)]; // ack'd at low

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
      recentAcknowledgements: acks,
    });

    // high > low, so should be kept
    const volumeInsight = results.find((r) => r.insight_type === 'volume_spike');
    expect(volumeInsight).toBeDefined();
    expect(volumeInsight!.severity).toBe('high');
  });

  it('does NOT suppress different guardrail type', () => {
    const workouts = buildVolumeSpikeWorkouts(30);
    // Ack is for high_rpe, not volume_spike
    const acks = [makeAck('high_rpe', 'high', 6)];

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
      recentAcknowledgements: acks,
    });

    // volume_spike should still appear (ack was for high_rpe)
    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeDefined();
  });

  it('does NOT suppress when ack is older than 24h', () => {
    const workouts = buildVolumeSpikeWorkouts(30);
    const acks = [makeAck('volume_spike', 'high', 25)]; // 25h ago — past cooldown

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
      recentAcknowledgements: acks,
    });

    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeDefined();
  });

  it('returns all insights when no acknowledgements', () => {
    const workouts = buildVolumeSpikeWorkouts(30);

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
    });

    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeDefined();
  });
});

describe('Volume Spike Low Severity Tier', () => {
  it('flags 22% spike as low severity', () => {
    const workouts = buildVolumeSpikeWorkouts(22);

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
    });

    const volumeInsight = results.find((r) => r.insight_type === 'volume_spike');
    expect(volumeInsight).toBeDefined();
    expect(volumeInsight!.severity).toBe('low');
  });

  it('flags 30% spike as medium severity', () => {
    const workouts = buildVolumeSpikeWorkouts(30);

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
    });

    const volumeInsight = results.find((r) => r.insight_type === 'volume_spike');
    expect(volumeInsight).toBeDefined();
    expect(volumeInsight!.severity).toBe('medium');
  });

  it('flags 45% spike as high severity', () => {
    const workouts = buildVolumeSpikeWorkouts(45);

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
    });

    const volumeInsight = results.find((r) => r.insight_type === 'volume_spike');
    expect(volumeInsight).toBeDefined();
    expect(volumeInsight!.severity).toBe('high');
  });

  it('does not flag 18% spike (below low threshold)', () => {
    const workouts = buildVolumeSpikeWorkouts(18);

    const results = computeGuardrails({
      experience: 'beginner',
      recentWorkouts: workouts,
    });

    expect(results.find((r) => r.insight_type === 'volume_spike')).toBeUndefined();
  });
});
