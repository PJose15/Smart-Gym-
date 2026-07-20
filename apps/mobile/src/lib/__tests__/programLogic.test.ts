/**
 * Tests for pure program logic — progress percentage, today day resolution,
 * day status, week label, sets/reps formatting, meta chips.
 *
 * Follows the challengeLogic.test.ts pattern: node test environment, no React,
 * no Supabase mocks needed for pure functions. All time-dependent functions
 * receive an injected `now` param for determinism.
 */
import {
  programProgressPct,
  resolveTodayDayNumber,
  dayStatus,
  weekLabel,
  formatSetsReps,
  buildMetaChips,
} from '../programLogic';
import { getTodaysProgramDay } from '@nexera/utils';
import { PROGRAM_CACHE_KEY } from '../programService';

// ─── programProgressPct ───────────────────────────────────────────────────────

describe('programProgressPct', () => {
  it('returns 0 when total <= 0', () => {
    expect(programProgressPct(5, 0)).toBe(0);
    expect(programProgressPct(5, -1)).toBe(0);
  });

  it('returns 0 when completed is negative', () => {
    expect(programProgressPct(-1, 10)).toBe(0);
  });

  it('returns 50 for (8, 16)', () => {
    expect(programProgressPct(8, 16)).toBe(50);
  });

  it('clamps to 100 when completed >= total', () => {
    expect(programProgressPct(16, 16)).toBe(100);
    expect(programProgressPct(20, 16)).toBe(100);
  });

  it('handles non-integer ratio (5/16 → 31.25)', () => {
    expect(programProgressPct(5, 16)).toBe(31.25);
  });

  it('returns 0 when completed is 0 and total > 0', () => {
    expect(programProgressPct(0, 10)).toBe(0);
  });
});

// ─── resolveTodayDayNumber ────────────────────────────────────────────────────

describe('resolveTodayDayNumber', () => {
  it('returns 1 when totalDays <= 0', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    expect(resolveTodayDayNumber('2026-07-10T00:00:00.000Z', 0, now)).toBe(1);
    expect(resolveTodayDayNumber('2026-07-10T00:00:00.000Z', -3, now)).toBe(1);
  });

  it('returns 1 for invalid assignedAt string', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    expect(resolveTodayDayNumber('not-a-date', 4, now)).toBe(1);
    expect(resolveTodayDayNumber('', 4, now)).toBe(1);
  });

  it('returns day 1 on the assignment day (0 days elapsed)', () => {
    const now = new Date('2026-07-10T06:00:00.000Z');
    expect(resolveTodayDayNumber('2026-07-10T00:00:00.000Z', 4, now)).toBe(1);
  });

  it('cycles — assigned 4 days ago with totalDays 4 → day 1 again', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const assignedAt = '2026-07-10T12:00:00.000Z'; // exactly 4 days ago
    expect(resolveTodayDayNumber(assignedAt, 4, now)).toBe(1);
  });

  it('assigned 5 days ago with totalDays 4 → day 2', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const assignedAt = '2026-07-10T12:00:00.000Z'; // exactly 5 days ago
    expect(resolveTodayDayNumber(assignedAt, 4, now)).toBe(2);
  });

  it('parity: result equals getTodaysProgramDay for 3 days before today with totalDays 4', () => {
    // Both must agree on which day we are on — they use the same real clock
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const assignedAt = threeDaysAgo.toISOString();
    const totalDays = 4;
    const now = new Date();
    const programLogicResult = resolveTodayDayNumber(assignedAt, totalDays, now);
    const utilsResult = getTodaysProgramDay(assignedAt, totalDays);
    expect(programLogicResult).toBe(utilsResult);
  });
});

// ─── dayStatus ────────────────────────────────────────────────────────────────

describe('dayStatus', () => {
  it('returns "complete" when dayNumber < todayDayNumber', () => {
    expect(dayStatus(1, 3)).toBe('complete');
    expect(dayStatus(2, 4)).toBe('complete');
  });

  it('returns "today" when dayNumber equals todayDayNumber', () => {
    expect(dayStatus(3, 3)).toBe('today');
    expect(dayStatus(1, 1)).toBe('today');
  });

  it('returns "upcoming" when dayNumber > todayDayNumber', () => {
    expect(dayStatus(4, 2)).toBe('upcoming');
    expect(dayStatus(3, 1)).toBe('upcoming');
  });
});

// ─── weekLabel ────────────────────────────────────────────────────────────────

describe('weekLabel', () => {
  it('formats "Week 2 of 8"', () => {
    expect(weekLabel(2, 8)).toBe('Week 2 of 8');
  });

  it('clamps week below 1 → "Week 1 of 8"', () => {
    expect(weekLabel(0, 8)).toBe('Week 1 of 8');
    expect(weekLabel(-2, 8)).toBe('Week 1 of 8');
  });

  it('clamps week above duration → "Week 8 of 8"', () => {
    expect(weekLabel(10, 8)).toBe('Week 8 of 8');
  });

  it('formats "Week 1 of 1" for single-week program', () => {
    expect(weekLabel(1, 1)).toBe('Week 1 of 1');
  });
});

// ─── formatSetsReps ───────────────────────────────────────────────────────────

describe('formatSetsReps', () => {
  it('returns "3×10" with multiplication sign', () => {
    expect(formatSetsReps(3, 10)).toBe('3×10');
  });

  it('works for other values', () => {
    expect(formatSetsReps(4, 12)).toBe('4×12');
    expect(formatSetsReps(1, 20)).toBe('1×20');
  });
});

// ─── buildMetaChips ───────────────────────────────────────────────────────────

describe('buildMetaChips', () => {
  it('returns all 4 chips when goal, trainer_name provided', () => {
    const chips = buildMetaChips({
      goal: 'hypertrophy',
      duration_weeks: 8,
      sessions_per_week: 4,
      trainer_name: 'Sam',
    });
    expect(chips).toEqual(['Hypertrophy', '8 weeks', '4x/week', 'Coach Sam']);
  });

  it('omits goal chip when goal is null', () => {
    const chips = buildMetaChips({
      goal: null,
      duration_weeks: 8,
      sessions_per_week: 4,
      trainer_name: 'Sam',
    });
    expect(chips).toEqual(['8 weeks', '4x/week', 'Coach Sam']);
  });

  it('shows "AI Coach" chip when trainer_name is null', () => {
    const chips = buildMetaChips({
      goal: 'hypertrophy',
      duration_weeks: 8,
      sessions_per_week: 4,
      trainer_name: null,
    });
    expect(chips).toContain('AI Coach');
    expect(chips).not.toContain('Coach null');
  });

  it('shows "AI Coach" chip when trainer_name is null and generated_by provided', () => {
    const chips = buildMetaChips({
      goal: null,
      duration_weeks: 6,
      sessions_per_week: 3,
      trainer_name: null,
    });
    expect(chips).toContain('AI Coach');
  });

  it('uses singular "1 week" for single-week program', () => {
    const chips = buildMetaChips({
      goal: null,
      duration_weeks: 1,
      sessions_per_week: 3,
      trainer_name: null,
    });
    expect(chips).toContain('1 week');
  });

  it('uses plural "N weeks" for multi-week programs', () => {
    const chips = buildMetaChips({
      goal: null,
      duration_weeks: 4,
      sessions_per_week: 3,
      trainer_name: null,
    });
    expect(chips).toContain('4 weeks');
  });
});

// ─── PROGRAM_CACHE_KEY (from programService) ─────────────────────────────────

describe('PROGRAM_CACHE_KEY', () => {
  it('produces "program:mem-1" for memberId "mem-1"', () => {
    expect(PROGRAM_CACHE_KEY('mem-1')).toBe('program:mem-1');
  });
});
