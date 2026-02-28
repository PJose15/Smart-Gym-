/**
 * Build a deterministic workout draft for Trainer Co-Pilot.
 * Generates a coach note draft based on a completed workout.
 */

import type { DraftSignals } from '@smartgym/types';
import type { WorkoutDraftInput, DraftOutput } from './types';
import {
  ackWorkout,
  highlightPR,
  highlightVolume,
  correctionFromGuardrails,
  correctionGeneral,
  nextSessionDirection,
  workoutTitle,
} from './templates';

export function buildWorkoutDraft(input: WorkoutDraftInput): DraftOutput {
  const {
    memberName,
    exercises,
    prs,
    volumeChangePct,
    totalVolumeKg,
    totalSets,
    totalReps,
    guardrails = [],
    goal,
    experience,
    units = 'kg',
  } = input;

  const unitLabel = units === 'lbs' ? 'lbs' : 'kg';
  const prSummaries = prs.map((pr) => ({
    exercise: pr.exercise_name,
    type: pr.type,
    value: pr.value,
  }));
  const guardrailSummaries = guardrails.map((g) => ({
    type: g.insight_type,
    severity: g.severity,
    message: g.message,
  }));

  // ── Build body sections ──────────────────────────────

  const sections: string[] = [];

  // 1) Acknowledgement
  sections.push(ackWorkout(memberName, totalSets, totalVolumeKg, unitLabel));

  // 2) Highlight
  const prHighlight = highlightPR(prSummaries, unitLabel);
  const volHighlight = highlightVolume(volumeChangePct);
  if (prHighlight) {
    sections.push(prHighlight);
  } else if (volHighlight) {
    sections.push(volHighlight);
  }

  // 3) Correction / Focus
  const guardrailCorrection = correctionFromGuardrails(guardrailSummaries);
  if (guardrailCorrection) {
    sections.push(guardrailCorrection);
  } else {
    sections.push(correctionGeneral(goal));
  }

  // 4) Next session direction
  sections.push(
    nextSessionDirection(goal, volumeChangePct, prs.length, guardrails.length > 0),
  );

  // ── Build title ──────────────────────────────────────

  const draft_title = workoutTitle(prs.length, guardrails.length > 0);

  // ── Build confidence ─────────────────────────────────

  const confidence = computeConfidence(input);

  // ── Build signals ────────────────────────────────────

  const signals: DraftSignals = {
    prs: prSummaries,
    volume_change_pct: volumeChangePct,
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume_kg: totalVolumeKg,
    guardrails: guardrailSummaries,
    goal,
    experience,
  };

  return {
    draft_title,
    draft_body: sections.filter(Boolean).join('\n\n'),
    confidence,
    signals,
  };
}

// ─── Confidence Scoring ─────────────────────────────────

function computeConfidence(input: WorkoutDraftInput): number {
  let score = 0.3; // base

  // Has exercises
  if (input.totalSets > 0) score += 0.15;

  // Has comparison data
  if (input.volumeChangePct !== null) score += 0.15;

  // Has PRs
  if (input.prs.length > 0) score += 0.1;

  // Has training profile
  if (input.goal) score += 0.1;
  if (input.experience) score += 0.05;

  // Has guardrail data
  if (input.guardrails && input.guardrails.length > 0) score += 0.1;

  // More sets = more data
  if (input.totalSets >= 8) score += 0.05;

  return Math.min(score, 0.95);
}
