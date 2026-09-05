import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { computeStreak } from '../rules/streaks';

// ─── Helpers ────────────────────────────────────────────

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function weeksAgo(weeks: number): string {
  return daysAgo(weeks * 7);
}

// ─── Tests ──────────────────────────────────────────────

describe('computeStreak', () => {
  it('returns zero streak for no workouts', () => {
    const result = computeStreak({ completedWorkoutDates: [] });
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.currentWeekActive).toBe(false);
    expect(result.shouldAwardBonus).toBe(false);
    expect(result.bonusPoints).toBe(0);
  });

  it('returns streak of 1 for a single workout this week', () => {
    const result = computeStreak({
      completedWorkoutDates: [daysAgo(0)], // today
    });
    expect(result.currentStreak).toBe(1);
    expect(result.currentWeekActive).toBe(true);
    expect(result.shouldAwardBonus).toBe(false); // need streak >= 2
    expect(result.bonusPoints).toBe(0);
  });

  it('counts consecutive weeks correctly', () => {
    const result = computeStreak({
      completedWorkoutDates: [
        daysAgo(0),   // this week
        daysAgo(7),   // last week
        daysAgo(14),  // 2 weeks ago
      ],
    });
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.currentWeekActive).toBe(true);
    expect(result.shouldAwardBonus).toBe(true);
    expect(result.bonusPoints).toBe(25); // 3 weeks → 25 pts (>= 2)
  });

  it('multiple workouts in same week count as 1 week', () => {
    const result = computeStreak({
      completedWorkoutDates: [
        daysAgo(0),
        daysAgo(1),
        daysAgo(2),
        daysAgo(7),
      ],
    });
    expect(result.currentStreak).toBe(2);
    expect(result.currentWeekActive).toBe(true);
  });

  it('gap in weeks resets current streak', () => {
    const result = computeStreak({
      completedWorkoutDates: [
        daysAgo(0),   // this week
        // gap: no workout last week
        daysAgo(14),  // 2 weeks ago
        daysAgo(21),  // 3 weeks ago
      ],
    });
    expect(result.currentStreak).toBe(1); // only this week
    expect(result.longestStreak).toBe(2); // the older consecutive pair
  });

  it('tracks longest streak across gaps', () => {
    const result = computeStreak({
      completedWorkoutDates: [
        daysAgo(0),    // this week
        // gap
        daysAgo(21),   // 3 weeks ago
        daysAgo(28),   // 4 weeks ago
        daysAgo(35),   // 5 weeks ago
        daysAgo(42),   // 6 weeks ago
      ],
    });
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(4); // the 4-week run from weeks ago
  });

  it('awards 25 pts for 2-week streak', () => {
    const result = computeStreak({
      completedWorkoutDates: [daysAgo(0), daysAgo(7)],
    });
    expect(result.bonusPoints).toBe(25);
    expect(result.shouldAwardBonus).toBe(true);
  });

  it('awards 50 pts for 4-week streak', () => {
    const result = computeStreak({
      completedWorkoutDates: [
        daysAgo(0), daysAgo(7), daysAgo(14), daysAgo(21),
      ],
    });
    expect(result.bonusPoints).toBe(50);
  });

  it('awards 100 pts for 8-week streak', () => {
    const dates = Array.from({ length: 8 }, (_, i) => daysAgo(i * 7));
    const result = computeStreak({ completedWorkoutDates: dates });
    expect(result.bonusPoints).toBe(100);
  });

  it('awards 150 pts for 12+ week streak', () => {
    const dates = Array.from({ length: 12 }, (_, i) => daysAgo(i * 7));
    const result = computeStreak({ completedWorkoutDates: dates });
    expect(result.bonusPoints).toBe(150);
  });

  it('provides a currentWeekKey for idempotency', () => {
    const result = computeStreak({ completedWorkoutDates: [daysAgo(0)] });
    expect(result.currentWeekKey).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('does not award bonus when current week is inactive', () => {
    const result = computeStreak({
      completedWorkoutDates: [daysAgo(7), daysAgo(14)],
    });
    // Streak of 2 from previous weeks, but current week not active
    expect(result.shouldAwardBonus).toBe(false);
  });

  it('grace period: counts streak from last week if current week inactive', () => {
    const result = computeStreak({
      completedWorkoutDates: [daysAgo(7), daysAgo(14), daysAgo(21)],
    });
    // Current week has no workout yet, but streak is still alive from last week
    expect(result.currentStreak).toBe(3);
    expect(result.currentWeekActive).toBe(false);
  });

  // ── UTC / date-string consistency (regression: server-local bucketing) ──

  it('buckets date-only session_date strings the same as full timestamps of the same UTC day', () => {
    const full = daysAgo(0);
    const dateOnly = full.slice(0, 10);
    const a = computeStreak({ completedWorkoutDates: [full] });
    const b = computeStreak({ completedWorkoutDates: [dateOnly] });
    expect(b.currentStreak).toBe(a.currentStreak);
    expect(b.currentWeekActive).toBe(a.currentWeekActive);
    expect(b.currentWeekKey).toBe(a.currentWeekKey);
  });

  describe('with a pinned clock', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('produces a real ISO-8601 week key (2026-01-01 is a Thursday in ISO week 1)', () => {
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      const result = computeStreak({ completedWorkoutDates: ['2026-01-01'] });
      // Week starts Monday 2025-12-29; its Thursday is 2026-01-01 → ISO 2026-W01
      expect(result.currentWeekKey).toBe('2026-W01');
      expect(result.currentWeekActive).toBe(true);
      expect(result.currentStreak).toBe(1);
    });

    it('counts consecutive weeks across a year boundary using UTC weeks', () => {
      vi.setSystemTime(new Date('2026-01-07T08:00:00Z')); // Wednesday, ISO week 2
      const result = computeStreak({
        completedWorkoutDates: ['2026-01-06', '2025-12-30', '2025-12-22'],
      });
      // Weeks of Jan 5, Dec 29, Dec 22 — three consecutive Mondays
      expect(result.currentStreak).toBe(3);
      expect(result.currentWeekKey).toBe('2026-W02');
    });

    it('a Sunday session lands in the Monday-started week that precedes it (UTC)', () => {
      vi.setSystemTime(new Date('2026-09-06T23:30:00Z')); // Sunday late UTC
      const result = computeStreak({
        completedWorkoutDates: ['2026-09-06', '2026-08-31'], // Sunday + the Monday of the same week
      });
      // Both dates are in the week starting Monday 2026-08-31 → one active week
      expect(result.currentStreak).toBe(1);
      expect(result.currentWeekActive).toBe(true);
    });
  });
});
