/**
 * Build a deterministic weekly check-in draft for Trainer Co-Pilot.
 * Generates a coach note draft summarizing a member's week.
 */

import type { DraftSignals } from '@smartgym/types';
import type { WeeklyDraftInput, DraftOutput } from './types';
import {
  ackWeekly,
  highlightPR,
  highlightConsistency,
  highlightVolume,
  correctionFromGuardrails,
  correctionGeneral,
  nextSessionDirection,
  weeklyTitle,
} from './templates';

export function buildWeeklyDraft(input: WeeklyDraftInput): DraftOutput {
  const {
    memberName,
    workoutsCompleted,
    prCount,
    prSummaries,
    activeDays,
    expectedDays,
    guardrails = [],
    totalVolumeKg,
    volumeChangePct,
    goal,
    experience,
    units = 'kg',
    periodStart,
    periodEnd,
  } = input;

  const unitLabel = units === 'lbs' ? 'lbs' : 'kg';
  const periodLabel = `this week (${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)})`;
  const guardrailSummaries = guardrails.map((g) => ({
    type: g.insight_type,
    severity: g.severity,
    message: g.message,
  }));

  // ── Build body sections ──────────────────────────────

  const sections: string[] = [];

  // 1) Acknowledgement
  sections.push(ackWeekly(memberName, workoutsCompleted, activeDays, periodLabel));

  // 2) Highlight — pick best one
  const prHighlight = highlightPR(prSummaries, unitLabel);
  const consistencyHighlight = highlightConsistency(workoutsCompleted, expectedDays);
  const volHighlight = highlightVolume(volumeChangePct);

  if (prHighlight) {
    sections.push(prHighlight);
  } else if (consistencyHighlight) {
    sections.push(consistencyHighlight);
  } else if (volHighlight) {
    sections.push(volHighlight);
  }

  // 3) Correction / Focus
  const guardrailCorrection = correctionFromGuardrails(guardrailSummaries);
  if (guardrailCorrection) {
    sections.push(guardrailCorrection);
  } else if (workoutsCompleted === 0) {
    sections.push('No worries if the schedule was tight. The important thing is getting back on track when you can.');
  } else {
    sections.push(correctionGeneral(goal));
  }

  // 4) Next session direction
  if (workoutsCompleted > 0) {
    sections.push(
      nextSessionDirection(goal, volumeChangePct, prCount, guardrails.length > 0),
    );
  } else {
    sections.push('When you\'re ready, let\'s start with a lighter session to ease back in.');
  }

  // ── Build title ──────────────────────────────────────

  const draft_title = weeklyTitle(workoutsCompleted, prCount, guardrails.length > 0);

  // ── Build confidence ─────────────────────────────────

  const confidence = computeWeeklyConfidence(input);

  // ── Build signals ────────────────────────────────────

  const signals: DraftSignals = {
    prs: prSummaries,
    volume_change_pct: volumeChangePct,
    total_volume_kg: totalVolumeKg,
    workouts_in_period: workoutsCompleted,
    guardrails: guardrailSummaries,
    streak_days: activeDays,
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

function computeWeeklyConfidence(input: WeeklyDraftInput): number {
  let score = 0.3; // base

  if (input.workoutsCompleted > 0) score += 0.15;
  if (input.workoutsCompleted >= 3) score += 0.1;
  if (input.volumeChangePct !== null) score += 0.1;
  if (input.prCount > 0) score += 0.1;
  if (input.goal) score += 0.1;
  if (input.guardrails && input.guardrails.length > 0) score += 0.05;
  if (input.expectedDays !== null) score += 0.05;

  return Math.min(score, 0.95);
}

// ─── Helpers ────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
