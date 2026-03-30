import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeHeroState, HeroInput } from '../rules/heroState';

// ─── Helpers ────────────────────────────────────────────

const BASE_INPUT: HeroInput = {
  firstName: 'Alex',
  leveledUp: false,
  newLevelName: null,
  newLevelNumber: null,
  programComplete: false,
  programName: null,
  recentPR: false,
  prExercise: null,
  currentStreak: 0,
  daysSinceLastWorkout: null,
  hasProgram: false,
  programWeek: null,
  programTotalWeeks: null,
  trainedToday: false,
  todaySessions: 0,
};

function withInput(overrides: Partial<HeroInput>): HeroInput {
  return { ...BASE_INPUT, ...overrides };
}

// Fix time to 10 AM for consistent greeting
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 27, 10, 0, 0)); // 10 AM → "Good morning"
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────

describe('computeHeroState', () => {
  // ─── Priority 1: Level Up ─────────────────────────────
  it('returns level-up variant when leveled up', () => {
    const result = computeHeroState(withInput({
      leveledUp: true,
      newLevelName: 'Warrior',
      newLevelNumber: 5,
    }));
    expect(result.variant).toBe('level-up');
    expect(result.headline).toContain('Level 5');
    expect(result.headline).toContain('Warrior');
    expect(result.metric).toBe('Level 5');
  });

  it('level-up takes priority over everything', () => {
    const result = computeHeroState(withInput({
      leveledUp: true,
      newLevelName: 'Elite',
      newLevelNumber: 7,
      programComplete: true,
      programName: 'Strength 4x',
      recentPR: true,
      prExercise: 'Bench Press',
      currentStreak: 8,
      trainedToday: true,
      todaySessions: 2,
    }));
    expect(result.variant).toBe('level-up');
  });

  // ─── Priority 2: Program Complete ─────────────────────
  it('returns program-complete variant', () => {
    const result = computeHeroState(withInput({
      programComplete: true,
      programName: 'Hypertrophy A',
    }));
    expect(result.variant).toBe('program-complete');
    expect(result.headline).toBe('Program Complete!');
    expect(result.subline).toContain('Hypertrophy A');
  });

  it('program-complete beats PR and streak', () => {
    const result = computeHeroState(withInput({
      programComplete: true,
      programName: 'Strength Plan',
      recentPR: true,
      prExercise: 'Squat',
      currentStreak: 12,
    }));
    expect(result.variant).toBe('program-complete');
  });

  // ─── Priority 3: Recent PR ─────────────────────────────
  it('returns pr-recent variant', () => {
    const result = computeHeroState(withInput({
      recentPR: true,
      prExercise: 'Lat Pulldown',
    }));
    expect(result.variant).toBe('pr-recent');
    expect(result.headline).toBe('New Personal Record!');
    expect(result.subline).toContain('Lat Pulldown');
  });

  // ─── Priority 4: Streak Milestone ─────────────────────
  it('returns streak-milestone at 4 weeks', () => {
    const result = computeHeroState(withInput({ currentStreak: 4 }));
    expect(result.variant).toBe('streak-milestone');
    expect(result.headline).toContain('4-Week');
  });

  it('returns streak-milestone at 8 weeks', () => {
    const result = computeHeroState(withInput({ currentStreak: 8 }));
    expect(result.variant).toBe('streak-milestone');
  });

  it('returns streak-milestone at 12 weeks', () => {
    const result = computeHeroState(withInput({ currentStreak: 12 }));
    expect(result.variant).toBe('streak-milestone');
  });

  it('does NOT return streak-milestone at non-multiple of 4', () => {
    const result = computeHeroState(withInput({ currentStreak: 5 }));
    expect(result.variant).not.toBe('streak-milestone');
  });

  // ─── Priority 5: Comeback ─────────────────────────────
  it('returns comeback when >14 days since last workout', () => {
    const result = computeHeroState(withInput({ daysSinceLastWorkout: 15 }));
    expect(result.variant).toBe('comeback');
    expect(result.greeting).toContain('Welcome back');
    expect(result.headline).toBe('Great to See You!');
  });

  it('comeback beats stale streak milestone (>14 days away with streak multiple of 4)', () => {
    const result = computeHeroState(withInput({ daysSinceLastWorkout: 20, currentStreak: 8 }));
    expect(result.variant).toBe('comeback');
  });

  it('does NOT return comeback at exactly 14 days', () => {
    const result = computeHeroState(withInput({ daysSinceLastWorkout: 14 }));
    expect(result.variant).not.toBe('comeback');
  });

  // ─── Priority 6: Program Week ─────────────────────────
  it('returns program-week when has program and not trained', () => {
    const result = computeHeroState(withInput({
      hasProgram: true,
      programName: 'Upper/Lower',
      programWeek: 3,
      programTotalWeeks: 8,
    }));
    expect(result.variant).toBe('program-week');
    expect(result.headline).toBe('Week 3 of 8');
    expect(result.metric).toBe('3/8');
  });

  it('program-week is skipped if already trained today', () => {
    const result = computeHeroState(withInput({
      hasProgram: true,
      programWeek: 2,
      programTotalWeeks: 6,
      trainedToday: true,
      todaySessions: 1,
    }));
    expect(result.variant).toBe('today-trained');
  });

  // ─── Priority 7: Today Trained ────────────────────────
  it('returns today-trained when member has sessions today', () => {
    const result = computeHeroState(withInput({
      trainedToday: true,
      todaySessions: 2,
    }));
    expect(result.variant).toBe('today-trained');
    expect(result.headline).toBe('Nice Work Today!');
    expect(result.subline).toContain('2 sessions');
  });

  it('today-trained shows singular for 1 session', () => {
    const result = computeHeroState(withInput({
      trainedToday: true,
      todaySessions: 1,
    }));
    expect(result.subline).toContain('1 session');
  });

  // ─── Priority 8: No Program ───────────────────────────
  it('returns no-program for brand new member', () => {
    const result = computeHeroState(BASE_INPUT);
    expect(result.variant).toBe('no-program');
    expect(result.headline).toBe("Let's Get Started");
  });

  // ─── Priority 9: Today Fresh ──────────────────────────
  it('returns today-fresh as default with program', () => {
    const result = computeHeroState(withInput({
      hasProgram: true,
      programName: 'Strength Plan',
      programWeek: null,
      programTotalWeeks: null,
    }));
    expect(result.variant).toBe('today-fresh');
    expect(result.headline).toBe('Ready to Train?');
    expect(result.subline).toContain('Strength Plan');
  });

  it('today-fresh with no program name', () => {
    const result = computeHeroState(withInput({
      hasProgram: true,
    }));
    expect(result.variant).toBe('today-fresh');
    expect(result.subline).toContain("Today's session");
  });

  // ─── Greeting Tests ───────────────────────────────────
  it('uses morning greeting at 10 AM', () => {
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good morning');
  });

  it('uses afternoon greeting at 2 PM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 14, 0, 0));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good afternoon');
  });

  it('uses evening greeting at 7 PM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 19, 0, 0));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good evening');
  });

  // ─── Greeting Boundary Tests ─────────────────────────
  it('uses morning greeting at 11:59 AM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 11, 59, 59));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good morning');
  });

  it('switches to afternoon at exactly 12:00 PM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 12, 0, 0));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good afternoon');
  });

  it('uses afternoon greeting at 4:59 PM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 16, 59, 59));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good afternoon');
  });

  it('switches to evening at exactly 5:00 PM', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 17, 0, 0));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good evening');
  });

  it('uses morning greeting at midnight (0:00)', () => {
    vi.setSystemTime(new Date(2026, 2, 27, 0, 0, 0));
    const result = computeHeroState(BASE_INPUT);
    expect(result.greeting).toContain('Good morning');
  });

  // ─── daysSinceLastWorkout Edge Cases ────────────────
  it('daysSinceLastWorkout: 0 does not trigger comeback', () => {
    const result = computeHeroState(withInput({ daysSinceLastWorkout: 0 }));
    expect(result.variant).not.toBe('comeback');
  });

  it('daysSinceLastWorkout: null does not trigger comeback', () => {
    const result = computeHeroState(withInput({ daysSinceLastWorkout: null }));
    expect(result.variant).not.toBe('comeback');
  });

  it('level-up at level 0 (edge: newLevelNumber = 0)', () => {
    const result = computeHeroState(withInput({
      leveledUp: true,
      newLevelName: 'Newcomer',
      newLevelNumber: 0,
    }));
    // Level 0 is valid because != null catches it
    expect(result.variant).toBe('level-up');
    expect(result.headline).toContain('Level 0');
  });

  // ─── All variants return required fields ──────────────
  it('every variant includes gradient and accent', () => {
    const scenarios: Partial<HeroInput>[] = [
      { leveledUp: true, newLevelName: 'X', newLevelNumber: 1 },
      { programComplete: true, programName: 'P' },
      { recentPR: true, prExercise: 'E' },
      { currentStreak: 4 },
      { daysSinceLastWorkout: 30 },
      { hasProgram: true, programWeek: 1, programTotalWeeks: 4 },
      { trainedToday: true, todaySessions: 1 },
      {}, // no-program
      { hasProgram: true }, // today-fresh
    ];

    for (const s of scenarios) {
      const result = computeHeroState(withInput(s));
      expect(result.gradient).toBeTruthy();
      expect(result.accent).toBeTruthy();
      expect(result.greeting).toBeTruthy();
      expect(result.headline).toBeTruthy();
    }
  });
});
