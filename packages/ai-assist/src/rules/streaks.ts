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

/** Returns the Monday (or configured weekStartDay) of the ISO week containing the given date */
function getWeekStart(date: Date, weekStartDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Formats a Date as YYYY-WXX key for idempotency */
function toWeekKey(date: Date): string {
  const year = date.getFullYear();
  const janFirst = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - janFirst.getTime()) / (86400000)) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
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

  const now = new Date();
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
    const date = new Date(dateStr);
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
