import { computeHeroState, HeroInput, HeroVariant } from '../heroState';

// Base input shape — has program, fresh day, no sessions
const BASE: HeroInput = {
  firstName: 'Test',
  streak: 0,
  todaySessionCount: 0,
  hasProgram: true,
  weeklyVolume: 0,
  weeklyWorkouts: 0,
  score: 0,
  level: 1,
};

function withInput(overrides: Partial<HeroInput>): HeroInput {
  return { ...BASE, ...overrides };
}

// Fix "now" so hoursSince / daysSince are deterministic
const NOW = new Date('2025-06-15T10:00:00Z').getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Variant selection ────────────────────────────────────────────

describe('computeHeroState variant selection', () => {
  test('default → today-fresh when hasProgram=true, no sessions', () => {
    const result = computeHeroState(BASE);
    expect(result.variant).toBe('today-fresh');
  });

  test('no-program when hasProgram=false', () => {
    const result = computeHeroState(withInput({ hasProgram: false }));
    expect(result.variant).toBe('no-program');
    expect(result.headline).toContain('Freestyle');
  });

  test('today-trained when todaySessionCount > 0', () => {
    const result = computeHeroState(withInput({ todaySessionCount: 1, streak: 3 }));
    expect(result.variant).toBe('today-trained');
  });

  test('today-trained with multiple sessions', () => {
    const result = computeHeroState(withInput({ todaySessionCount: 3, streak: 5 }));
    expect(result.variant).toBe('today-trained');
    expect(result.headline).toContain('3 sessions today');
  });

  test('level-up within 24h', () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      leveledUpAt: twoHoursAgo,
      level: 5,
      levelName: 'Iron',
      score: 1200,
    }));
    expect(result.variant).toBe('level-up');
    expect(result.headline).toContain('Level 5');
    expect(result.headline).toContain('Iron');
  });

  test('level-up expired (>24h) falls through', () => {
    const twoDaysAgo = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({ leveledUpAt: twoDaysAgo, level: 5 }));
    expect(result.variant).not.toBe('level-up');
  });

  test('program-complete within 48h', () => {
    const oneHourAgo = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      programJustCompleted: true,
      programCompletedAt: oneHourAgo,
      programTitle: 'Strength A',
      programSessionsCompleted: 24,
      weeklyVolume: 15000,
    }));
    expect(result.variant).toBe('program-complete');
    expect(result.headline).toContain('Strength A complete');
  });

  test('program-complete expired (>48h) falls through', () => {
    const threeDaysAgo = new Date(NOW - 72 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      programJustCompleted: true,
      programCompletedAt: threeDaysAgo,
    }));
    expect(result.variant).not.toBe('program-complete');
  });

  test('pr-recent when lastSessionIsPR and today', () => {
    const today = new Date(NOW - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const result = computeHeroState(withInput({
      lastSessionIsPR: true,
      lastSessionDate: today,
      lastSessionPRMachine: 'Bench Press',
      lastSessionPRWeight: 225,
      lastSessionPRImprovement: 10,
    }));
    expect(result.variant).toBe('pr-recent');
    expect(result.headline).toContain('Bench Press');
  });

  test('streak-milestone at 7 days with session today', () => {
    const result = computeHeroState(withInput({ streak: 7, todaySessionCount: 1 }));
    expect(result.variant).toBe('streak-milestone');
    expect(result.headline).toContain('7-day streak');
  });

  test.each([14, 30, 60, 90, 120, 180, 365])('streak-milestone at %d days', (streak) => {
    const result = computeHeroState(withInput({ streak, todaySessionCount: 1 }));
    expect(result.variant).toBe('streak-milestone');
  });

  test('streak non-milestone (e.g. 8) → not streak-milestone', () => {
    const result = computeHeroState(withInput({ streak: 8, todaySessionCount: 1 }));
    expect(result.variant).not.toBe('streak-milestone');
    expect(result.variant).toBe('today-trained');
  });

  test('comeback after 7+ days', () => {
    const tenDaysAgo = new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({ lastSessionDate: tenDaysAgo }));
    expect(result.variant).toBe('comeback');
    expect(result.headline).toBe('Welcome back.');
  });

  test('comeback 14+ days includes day count', () => {
    const twentyDaysAgo = new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({ lastSessionDate: twentyDaysAgo }));
    expect(result.variant).toBe('comeback');
    expect(result.subline).toContain('20 days');
  });

  test('program-week when isFirstDayOfProgramWeek', () => {
    const result = computeHeroState(withInput({
      isFirstDayOfProgramWeek: true,
      programWeekNumber: 3,
      programTotalWeeks: 8,
      programTitle: 'Hypertrophy B',
    }));
    expect(result.variant).toBe('program-week');
    expect(result.headline).toContain('Week 3');
  });
});

// ── Priority ordering ────────────────────────────────────────────

describe('priority ordering', () => {
  test('level-up beats pr-recent', () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      leveledUpAt: twoHoursAgo,
      level: 5,
      lastSessionIsPR: true,
      lastSessionDate: twoHoursAgo,
    }));
    expect(result.variant).toBe('level-up');
  });

  test('program-complete beats pr-recent', () => {
    const oneHourAgo = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      programJustCompleted: true,
      programCompletedAt: oneHourAgo,
      lastSessionIsPR: true,
      lastSessionDate: oneHourAgo,
    }));
    expect(result.variant).toBe('program-complete');
  });

  test('pr-recent beats streak-milestone', () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      lastSessionIsPR: true,
      lastSessionDate: twoHoursAgo,
      streak: 30,
      todaySessionCount: 1,
    }));
    expect(result.variant).toBe('pr-recent');
  });

  test('comeback beats program-week', () => {
    const tenDaysAgo = new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeHeroState(withInput({
      lastSessionDate: tenDaysAgo,
      isFirstDayOfProgramWeek: true,
    }));
    expect(result.variant).toBe('comeback');
  });

  test('program-week beats today-trained (when no session)', () => {
    // program-week requires todaySessionCount=0 (since today-trained fires at >0)
    // and isFirstDayOfProgramWeek=true
    const result = computeHeroState(withInput({
      isFirstDayOfProgramWeek: true,
      todaySessionCount: 0,
    }));
    expect(result.variant).toBe('program-week');
  });
});

// ── Greeting by time of day ──────────────────────────────────────

describe('greeting by time of day', () => {
  test('morning greeting before 12', () => {
    jest.setSystemTime(new Date('2025-06-15T08:00:00'));
    const result = computeHeroState(BASE);
    expect(result.greeting).toBe('Good morning,');
  });

  test('afternoon greeting 12-17', () => {
    jest.setSystemTime(new Date('2025-06-15T14:00:00'));
    const result = computeHeroState(BASE);
    expect(result.greeting).toBe('Good afternoon,');
  });

  test('evening greeting after 17', () => {
    jest.setSystemTime(new Date('2025-06-15T20:00:00'));
    const result = computeHeroState(BASE);
    expect(result.greeting).toBe('Good evening,');
  });
});

// ── Colors ───────────────────────────────────────────────────────

describe('accent colors and gradients', () => {
  const EXPECTED_COLORS: Record<string, string> = {
    'today-fresh': '#7C5CFF',
    'today-trained': '#00C896',
    'pr-recent': '#FFD700',
    'streak-milestone': '#FF6B35',
    'comeback': '#606070',
    'no-program': '#606070',
    'level-up': '#7C5CFF',
    'program-complete': '#FFD700',
    'program-week': '#7C5CFF',
  };

  test('all variants return correct accentColor', () => {
    // today-fresh (default)
    expect(computeHeroState(BASE).accentColor).toBe(EXPECTED_COLORS['today-fresh']);

    // no-program
    expect(computeHeroState(withInput({ hasProgram: false })).accentColor)
      .toBe(EXPECTED_COLORS['no-program']);

    // today-trained
    expect(computeHeroState(withInput({ todaySessionCount: 1 })).accentColor)
      .toBe(EXPECTED_COLORS['today-trained']);
  });

  test('all variants return gradient as [string, string]', () => {
    const result = computeHeroState(BASE);
    expect(result.gradientColors).toHaveLength(2);
    expect(typeof result.gradientColors[0]).toBe('string');
    expect(typeof result.gradientColors[1]).toBe('string');
  });
});

// ── Metric field ─────────────────────────────────────────────────

describe('metric field', () => {
  test('today-fresh with focus shows metric', () => {
    const result = computeHeroState(withInput({ programTodaysFocus: 'Chest & Triceps' }));
    expect(result.metric).toEqual({ value: 'Chest & Triceps', label: "today's focus" });
  });

  test('today-fresh without focus has no metric', () => {
    const result = computeHeroState(BASE);
    expect(result.metric).toBeUndefined();
  });

  test('no-program with streak shows streak metric', () => {
    const result = computeHeroState(withInput({ hasProgram: false, streak: 5 }));
    expect(result.metric).toEqual({ value: '5', label: 'day streak' });
  });

  test('no-program without streak has no metric', () => {
    const result = computeHeroState(withInput({ hasProgram: false, streak: 0 }));
    expect(result.metric).toBeUndefined();
  });
});
