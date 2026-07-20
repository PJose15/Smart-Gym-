/**
 * Pure program logic — progress percentage, today day resolution, day status,
 * week label, sets/reps formatting, meta chips.
 *
 * Mirrors challengeLogic.ts pattern: no Supabase, no React, no side effects.
 * All time-dependent functions accept an injected `now` param for determinism.
 */

// ─── programProgressPct ───────────────────────────────────────────────────────

/**
 * Compute session completion percentage for a program.
 * Returns 0 when sessionsTotal <= 0 or sessionsCompleted < 0.
 * Clamped to [0, 100].
 */
export function programProgressPct(sessionsCompleted: number, sessionsTotal: number): number {
  if (sessionsTotal <= 0 || sessionsCompleted < 0) return 0;
  return Math.min(100, (sessionsCompleted / sessionsTotal) * 100);
}

// ─── resolveTodayDayNumber ────────────────────────────────────────────────────

/**
 * Determine which program day to show based on assignment date and injected `now`.
 * Cycles through days: floor((now - assignedAt) / 86400000) % totalDays + 1
 *
 * Mirrors @nexera/utils getTodaysProgramDay with injected now — the home screen
 * TodayZone uses that helper with ai_programs.created_at, and the program screen
 * must highlight the SAME day (research Open Question 2 resolved: home-screen
 * consistency wins over DB day_number).
 *
 * Guards:
 * - totalDays <= 0 → 1
 * - invalid assignedAt date string → 1
 */
export function resolveTodayDayNumber(
  assignedAt: string,
  totalDays: number,
  now: Date,
): number {
  if (totalDays <= 0) return 1;
  const assigned = new Date(assignedAt);
  if (isNaN(assigned.getTime())) return 1;
  const daysDiff = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24));
  return (daysDiff % totalDays) + 1;
}

// ─── dayStatus ────────────────────────────────────────────────────────────────

/**
 * Classify a day relative to today in the current rotation.
 * complete: dayNumber < todayDayNumber (done this cycle, per research Pitfall 4:
 *   do NOT try to map sessions_completed to specific days)
 * today: dayNumber === todayDayNumber
 * upcoming: dayNumber > todayDayNumber
 */
export function dayStatus(
  dayNumber: number,
  todayDayNumber: number,
): 'complete' | 'today' | 'upcoming' {
  if (dayNumber < todayDayNumber) return 'complete';
  if (dayNumber === todayDayNumber) return 'today';
  return 'upcoming';
}

// ─── weekLabel ────────────────────────────────────────────────────────────────

/**
 * Human-readable current week label clamped to valid range.
 * e.g. "Week 2 of 8"
 */
export function weekLabel(weekNumber: number, durationWeeks: number): string {
  const max = Math.max(1, durationWeeks);
  const clamped = Math.max(1, Math.min(max, weekNumber));
  return `Week ${clamped} of ${max}`;
}

// ─── formatSetsReps ───────────────────────────────────────────────────────────

/**
 * Format sets × reps using a multiplication sign (×, U+00D7), matching
 * TodayZone rendering.
 * e.g. formatSetsReps(3, 10) → "3×10"
 */
export function formatSetsReps(sets: number, reps: number): string {
  return `${sets}×${reps}`;
}

// ─── buildMetaChips ──────────────────────────────────────────────────────────

interface MetaChipInput {
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  trainer_name: string | null;
}

/**
 * Build display chips for the program header.
 *
 * Order: [Capitalized goal?], "N week(s)", "Nx/week", ["Coach {name}" | "AI Coach"]
 * - goal null → omitted
 * - trainer_name null → "AI Coach"
 * - 1 week → "1 week" (singular)
 */
export function buildMetaChips(program: MetaChipInput): string[] {
  const chips: string[] = [];

  if (program.goal) {
    chips.push(
      program.goal.charAt(0).toUpperCase() + program.goal.slice(1),
    );
  }

  const weeks = program.duration_weeks;
  chips.push(weeks === 1 ? '1 week' : `${weeks} weeks`);

  chips.push(`${program.sessions_per_week}x/week`);

  if (program.trainer_name) {
    chips.push(`Coach ${program.trainer_name}`);
  } else {
    chips.push('AI Coach');
  }

  return chips;
}
