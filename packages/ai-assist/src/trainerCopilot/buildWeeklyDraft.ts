/**
 * Build a deterministic weekly check-in draft for Trainer Co-Pilot.
 * Generates a coach note draft summarizing a member's week.
 */

import type { DraftSignals } from '@nexera/types';
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
  feedbackTrendNote,
  adherenceNote,
  applyTone,
  applyVerbosity,
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
    feedbackTrends,
    adherenceVsPlan,
    style,
  } = input;

  const tone = style?.tone ?? 'supportive';
  const verbosity = style?.verbosity ?? 'standard';

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

  // 4) Feedback trends (Phase 2.5.4)
  if (feedbackTrends && feedbackTrends.discomfort_count_7d > 0) {
    const trendNote = feedbackTrendNote(
      feedbackTrends.discomfort_count_7d,
      feedbackTrends.top_body_areas,
      tone,
    );
    sections.push(trendNote);

    // For zero-workout weeks with discomfort history, emphasize check-in
    if (workoutsCompleted === 0) {
      sections.push('Given the recent discomfort reports, a check-in before the next session would be helpful.');
    }
  }

  // 5) Adherence (Phase 2.5.4)
  if (adherenceVsPlan) {
    sections.push(
      adherenceNote(adherenceVsPlan.actual_workouts, adherenceVsPlan.expected_workouts, tone),
    );
  }

  // 6) Next session direction
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
    feedback_trends: feedbackTrends,
    adherence_vs_plan: adherenceVsPlan,
  };

  // Apply style transforms
  let body = sections.filter(Boolean).join('\n\n');
  body = applyTone(body, tone);
  body = applyVerbosity(body, verbosity);

  return {
    draft_title,
    draft_body: body,
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
