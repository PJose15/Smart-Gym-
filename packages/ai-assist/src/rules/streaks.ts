// ─── Streak Computation Module ──────────────────────────
// Pure function — no Supabase dependency. Pass workout dates in, get streak info out.

export interface StreakInput {
  /** Completed workout dates (ISO strings) */
  completedWorkoutDates: string[];
  /** Day the week starts on (0=Sunday, 1=Monday). Default: 1 (Monday) */
  weekStartDay?: number;
}

export interface StreakResult {
  /** Current consecutive weeks with at least 1 workout */
  currentStreak: number;
  /** Longest streak ever achieved */
  longestStreak: number;
  /** Whether the current week already has a workout */
  currentWeekActive: boolean;
  /** Whether a streak bonus should be awarded this week */
  shouldAwardBonus: boolean;
  /** Bonus points for the current streak milestone */
  bonusPoints: number;
  /** ISO week string for the current week (for idempotent reference_id) */
  currentWeekKey: string;
}

// ─── Helpers ────────────────────────────────────────────
// All date math runs in UTC on the DATE PART of the input strings. Session
// dates are date-only strings (session_date), so parsing/deriving anything in
// server-local time shifted dates by a day in non-UTC deployments and made
// week arithmetic drift across DST boundaries.

const ONE_DAY_MS = 86_400_000;

/**
 * Parses the date part (YYYY-MM-DD) of an ISO string as UTC midnight.
 * Accepts both date-only strings (session_date) and full ISO timestamps.
 */
function parseUTCDate(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
}

/** Returns UTC midnight of the week start (weekStartDay: 0=Sun, 1=Mon) containing the given UTC date */
function getWeekStart(date: Date, weekStartDay: number): Date {
  const day = date.getUTCDay();
  const diff = (day - weekStartDay + 7) % 7;
  return new Date(date.getTime() - diff * ONE_DAY_MS);
}

/**
 * Formats a Date as a real ISO-8601 YYYY-WXX week key (UTC) for idempotency.
 * (The previous implementation used ceil(dayOfYear / 7) — a fake week number
 * that disagreed with ISO weeks and could collide/skip around year boundaries.)
 */
function toWeekKey(date: Date): string {
  // ISO week: Thursday of the current week determines the week-numbering year
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to Thursday
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / ONE_DAY_MS + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns bonus points for a given streak length */
function getBonusPoints(streakWeeks: number): number {
  if (streakWeeks >= 12) return 150;
  if (streakWeeks >= 8) return 100;
  if (streakWeeks >= 4) return 50;
  if (streakWeeks >= 2) return 25;
  return 0;
}

// ─── Engine ─────────────────────────────────────────────

export function computeStreak(input: StreakInput): StreakResult {
  const { completedWorkoutDates, weekStartDay = 1 } = input;

  // "Today" as a UTC date — consistent with session_date date-only strings
  const now = parseUTCDate(new Date().toISOString());
  const currentWeekStart = getWeekStart(now, weekStartDay);
  const currentWeekKey = toWeekKey(currentWeekStart);

  if (completedWorkoutDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      currentWeekActive: false,
      shouldAwardBonus: false,
      bonusPoints: 0,
      currentWeekKey,
    };
  }

  // Group dates into week-start keys
  const weekSet = new Set<string>();
  let currentWeekActive = false;

  for (const dateStr of completedWorkoutDates) {
    const date = parseUTCDate(dateStr);
    const ws = getWeekStart(date, weekStartDay);
    const key = ws.getTime();
    weekSet.add(key.toString());

    if (ws.getTime() === currentWeekStart.getTime()) {
      currentWeekActive = true;
    }
  }

  // Sort unique weeks descending
  const sortedWeeks = Array.from(weekSet)
    .map(Number)
    .sort((a, b) => b - a);

  // Walk backwards from the most recent active week
  // to count the current streak
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  let currentStreak = 0;

  // Determine the starting week for streak counting:
  // If the current week is active, start from it.
  // Otherwise, start from the previous week (grace: streak still counts
  // if user hasn't worked out *yet* this week but was active last week).
  let checkWeek: number;
  if (currentWeekActive) {
    checkWeek = currentWeekStart.getTime();
  } else {
    // Previous week
    checkWeek = currentWeekStart.getTime() - oneWeekMs;
  }

  for (let i = 0; i < sortedWeeks.length; i++) {
    const expected = checkWeek - i * oneWeekMs;
    if (sortedWeeks.includes(expected)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Also compute longest streak across all weeks
  let longestStreak = 0;
  let tempStreak = 1;

  // Sort ascending for longest streak calculation
  const ascWeeks = [...sortedWeeks].sort((a, b) => a - b);

  for (let i = 1; i < ascWeeks.length; i++) {
    const diff = ascWeeks[i] - ascWeeks[i - 1];
    if (diff === oneWeekMs) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  longestStreak = Math.max(longestStreak, currentStreak);

  const bonusPoints = getBonusPoints(currentStreak);
  const shouldAwardBonus = currentWeekActive && currentStreak >= 2;

  return {
    currentStreak,
    longestStreak,
    currentWeekActive,
    shouldAwardBonus,
    bonusPoints,
    currentWeekKey,
  };
}
