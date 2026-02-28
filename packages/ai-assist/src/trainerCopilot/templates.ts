/**
 * Deterministic template banks for Trainer Co-Pilot draft generation.
 * These templates form the building blocks of coach note drafts.
 */

// ─── Acknowledgement Templates ──────────────────────────

export function ackWorkout(name: string, totalSets: number, totalVolumeKg: number, units: string): string {
  const vol = units === 'lbs' ? Math.round(totalVolumeKg * 2.205) : Math.round(totalVolumeKg);
  return `${name} completed a session with ${totalSets} sets and ${vol} ${units} total volume.`;
}

export function ackWeekly(name: string, workouts: number, activeDays: number, periodLabel: string): string {
  if (workouts === 0) {
    return `${name} didn't log any workouts ${periodLabel}. Let's check in and see how things are going.`;
  }
  return `${name} logged ${workouts} workout${workouts > 1 ? 's' : ''} across ${activeDays} day${activeDays > 1 ? 's' : ''} ${periodLabel}.`;
}

// ─── Highlight Templates ────────────────────────────────

export function highlightPR(prs: Array<{ exercise: string; type: string; value: number }>, units: string): string {
  if (prs.length === 0) return '';
  if (prs.length === 1) {
    const pr = prs[0];
    const label = prTypeLabel(pr.type);
    return `New ${label} on ${pr.exercise} — ${formatPrValue(pr.type, pr.value, units)}. Great work!`;
  }
  return `Hit ${prs.length} new personal records this session. That's strong progress.`;
}

export function highlightConsistency(workouts: number, expectedDays: number | null): string {
  if (expectedDays && workouts >= expectedDays) {
    return `Hit every planned session this week. Consistency is the real superpower.`;
  }
  if (workouts >= 4) {
    return `${workouts} sessions this week — excellent commitment.`;
  }
  if (workouts >= 3) {
    return `Solid ${workouts}-session week. Steady progress builds results.`;
  }
  return '';
}

export function highlightVolume(changePct: number | null): string {
  if (changePct === null) return '';
  if (changePct > 10) {
    return `Volume up ${changePct}% compared to last time. The body is responding well.`;
  }
  if (changePct >= 0) {
    return 'Maintained volume from the previous session — good consistency.';
  }
  if (changePct > -10) {
    return 'Volume slightly down — this can happen and is completely normal.';
  }
  return `Volume dropped ${Math.abs(changePct)}%. Consider whether fatigue or schedule changes played a role.`;
}

// ─── Correction Templates ───────────────────────────────

export function correctionFromGuardrails(guardrails: Array<{ type: string; severity: string; message: string }>): string {
  if (guardrails.length === 0) return '';
  // Pick highest severity guardrail
  const priority = ['high', 'medium', 'low'];
  const sorted = [...guardrails].sort((a, b) => priority.indexOf(a.severity) - priority.indexOf(b.severity));
  const top = sorted[0];

  const corrections: Record<string, string> = {
    volume_spike: 'Volume has increased quickly. Consider easing the intensity in the next session to allow adaptation.',
    high_rpe: 'Recent sessions have been pushing close to max effort. A lighter session or deload might be beneficial.',
    rep_collapse: 'Reps are dropping within sets more than expected. Try reducing weight slightly or adding more rest between sets.',
    recovery_overlap: 'The same muscle groups have been trained multiple days in a row. Adding rest or switching focus would help recovery.',
  };

  return corrections[top.type] ?? top.message;
}

export function correctionGeneral(goal: string | undefined): string {
  const tips: Record<string, string> = {
    hypertrophy: 'Keep focusing on controlled reps in the 8-12 range with moderate rest periods.',
    strength: 'Prioritize heavier loads with longer rest (2-3 min) to maintain quality on working sets.',
    endurance: 'Maintain higher rep ranges and shorter rest to build muscular endurance.',
    general: 'Continue with balanced training — mix different rep ranges and exercises.',
  };
  return tips[goal ?? 'general'] ?? tips.general;
}

// ─── Next Session Direction ─────────────────────────────

export function nextSessionDirection(
  goal: string | undefined,
  volumeChangePct: number | null,
  prCount: number,
  hasGuardrails: boolean,
): string {
  if (hasGuardrails) {
    return 'Next session: take it a bit easier. Focus on form and listen to your body.';
  }
  if (prCount > 0) {
    return 'Next session: maintain current loads. After a PR, consolidation is the smart move.';
  }
  if (volumeChangePct !== null && volumeChangePct > 10) {
    return 'Next session: hold these numbers. Let the body catch up before pushing further.';
  }
  if (goal === 'strength') {
    return 'Next session: try adding 1-2 reps at your working weight, or a small weight bump on your top set.';
  }
  return 'Next session: aim to match or slightly beat these numbers. Small, consistent gains add up.';
}

// ─── Title Templates ────────────────────────────────────

export function workoutTitle(prCount: number, hasGuardrails: boolean): string {
  if (prCount > 0) return 'Great session — new PR!';
  if (hasGuardrails) return 'Session notes — a few things to watch';
  return 'Good session — keep it up';
}

export function weeklyTitle(workouts: number, prCount: number, hasGuardrails: boolean): string {
  if (workouts === 0) return 'Weekly check-in — let\'s reconnect';
  if (prCount > 0) return 'Weekly recap — PRs and progress';
  if (hasGuardrails) return 'Weekly recap — a few notes';
  return 'Weekly recap — solid week';
}

// ─── Helpers ────────────────────────────────────────────

function prTypeLabel(type: string): string {
  if (type === 'PR_WEIGHT') return 'weight PR';
  if (type === 'PR_REPS') return 'rep PR';
  if (type === 'PR_EST_1RM') return 'estimated 1RM PR';
  return 'PR';
}

function formatPrValue(type: string, value: number, units: string): string {
  if (type === 'PR_REPS') return `${value} reps`;
  const displayVal = units === 'lbs' ? Math.round(value * 2.205) : Math.round(value);
  return `${displayVal} ${units}`;
}
