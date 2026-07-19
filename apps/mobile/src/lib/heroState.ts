/**
 * Hero State — computes the dynamic hero zone variant for the home screen.
 * Based on DOC_07: Priority-ordered variant selection.
 */

export type HeroVariant =
  | 'today-fresh'
  | 'today-trained'
  | 'pr-recent'
  | 'streak-milestone'
  | 'program-week'
  | 'comeback'
  | 'no-program'
  | 'level-up'
  | 'program-complete';

export interface HeroState {
  variant: HeroVariant;
  greeting: string;
  headline: string;
  subline: string;
  metric?: {
    value: string;
    label: string;
  };
  accentColor: string;
  gradientColors: [string, string];
}

export interface HeroInput {
  firstName: string;
  streak: number;
  todaySessionCount: number;
  hasProgram: boolean;
  programTitle?: string;
  programWeekNumber?: number;
  programTotalWeeks?: number;
  programDayNumber?: number;
  programTotalDays?: number;
  programSessionsCompleted?: number;
  programEstDuration?: number;
  programTodaysFocus?: string;
  programMachineCount?: number;
  lastSessionDate?: string | null;
  lastSessionIsPR?: boolean;
  lastSessionPRMachine?: string;
  lastSessionPRWeight?: number;
  lastSessionPRImprovement?: number;
  weeklyVolume: number;
  weeklyWorkouts: number;
  score: number;
  level: number;
  levelName?: string;
  leveledUpAt?: string | null;
  programJustCompleted?: boolean;
  programCompletedAt?: string | null;
  isFirstDayOfProgramWeek?: boolean;
}

const STREAK_MILESTONES = [7, 14, 30, 60, 90, 120, 180, 365];

const HERO_COLORS: Record<HeroVariant, { accent: string; gradient: [string, string] }> = {
  'today-fresh': {
    accent: '#E0142F',
    gradient: ['#0A0A0C', '#16161A'],
  },
  'today-trained': {
    accent: '#00C896',
    gradient: ['#0a1a0a', '#142014'],
  },
  'pr-recent': {
    accent: '#E8B339',
    gradient: ['#1a1200', '#2a1e00'],
  },
  'streak-milestone': {
    accent: '#FF6B35',
    gradient: ['#1a0800', '#2a1000'],
  },
  'program-week': {
    accent: '#E0142F',
    gradient: ['#120204', '#28060c'],
  },
  'comeback': {
    accent: '#6B6870',
    gradient: ['#12100e', '#1e1c18'],
  },
  'no-program': {
    accent: '#6B6870',
    gradient: ['#0f0f0f', '#1a1a1a'],
  },
  'level-up': {
    accent: '#E0142F',
    gradient: ['#140004', '#28000a'],
  },
  'program-complete': {
    accent: '#E8B339',
    gradient: ['#1a1200', '#2e2000'],
  },
};

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function getStreakMilestoneMessage(streak: number): string {
  if (streak >= 365) return 'A full year. Legendary.';
  if (streak >= 180) return 'Half a year. Unstoppable.';
  if (streak >= 90) return 'Three months of consistency. Elite.';
  if (streak >= 60) return 'Two months strong. Few make it here.';
  if (streak >= 30) return 'One month. Officially a habit.';
  if (streak >= 14) return 'Two weeks straight. Building momentum.';
  return 'One week down. Just getting started.';
}

function makeHero(variant: HeroVariant, greeting: string, headline: string, subline: string, metric?: HeroState['metric']): HeroState {
  const c = HERO_COLORS[variant];
  return { variant, greeting, headline, subline, metric, accentColor: c.accent, gradientColors: c.gradient };
}

export function computeHeroState(input: HeroInput): HeroState {
  const greeting = getGreeting();
  const daysSinceLastSession = daysSince(input.lastSessionDate);

  // Priority 1: Level up (within 24 hours)
  if (input.leveledUpAt && hoursSince(input.leveledUpAt) < 24) {
    return makeHero('level-up', greeting,
      `Level ${input.level}${input.levelName ? ` — ${input.levelName}` : ''}`,
      'You earned it. Keep building.',
      { value: input.score.toLocaleString(), label: 'SmartGym points' }
    );
  }

  // Priority 2: Program complete (within 48 hours)
  if (input.programJustCompleted && input.programCompletedAt && hoursSince(input.programCompletedAt) < 48) {
    return makeHero('program-complete', greeting,
      `${input.programTitle ?? 'Program'} complete.`,
      `${input.programSessionsCompleted ?? 0} sessions. You showed up.`,
      { value: `${input.weeklyVolume.toLocaleString()} lbs`, label: 'total volume' }
    );
  }

  // Priority 3: PR in last session (within 24 hours)
  if (input.lastSessionIsPR && daysSinceLastSession < 1) {
    return makeHero('pr-recent', greeting,
      `New PR: ${input.lastSessionPRMachine ?? 'Personal Record'}`,
      input.lastSessionPRWeight
        ? `${input.lastSessionPRWeight} lbs${input.lastSessionPRImprovement ? ` · +${input.lastSessionPRImprovement} lbs from your previous best` : ''}`
        : 'You pushed through a new ceiling.',
      input.lastSessionPRImprovement
        ? { value: `+${input.lastSessionPRImprovement}`, label: 'lbs improvement' }
        : undefined
    );
  }

  // Priority 4: Streak milestone (just hit 7, 14, 30, etc.)
  if (STREAK_MILESTONES.includes(input.streak) && input.todaySessionCount > 0) {
    return makeHero('streak-milestone', greeting,
      `${input.streak}-day streak.`,
      getStreakMilestoneMessage(input.streak),
      { value: `${input.streak}`, label: 'days straight' }
    );
  }

  // Priority 5: Comeback after 7+ days
  if (daysSinceLastSession >= 7 && input.lastSessionDate) {
    return makeHero('comeback', greeting,
      'Welcome back.',
      daysSinceLastSession >= 14
        ? `It's been ${daysSinceLastSession} days. Your program is waiting. Start fresh today.`
        : `${daysSinceLastSession} days since your last session. Let's get back to it.`,
      { value: `${daysSinceLastSession}d`, label: 'since last session' }
    );
  }

  // Priority 6: New program week
  if (input.hasProgram && input.isFirstDayOfProgramWeek) {
    return makeHero('program-week', greeting,
      `Week ${input.programWeekNumber ?? 1} starts today.`,
      `${input.programTitle ?? 'Your program'} · ${input.programTotalDays ? input.programTotalDays - (input.programDayNumber ?? 0) : '?'} sessions left`,
      input.programWeekNumber && input.programTotalWeeks
        ? { value: `Week ${input.programWeekNumber}/${input.programTotalWeeks}`, label: 'of your program' }
        : undefined
    );
  }

  // Priority 7: Already trained today
  if (input.todaySessionCount > 0) {
    return makeHero('today-trained', greeting,
      input.todaySessionCount === 1
        ? `Session done. Day ${input.streak} in the books.`
        : `${input.todaySessionCount} sessions today.`,
      `Streak: ${input.streak} days · Volume today: ${input.weeklyVolume.toLocaleString()} lbs`,
      { value: `${input.streak}`, label: 'day streak' }
    );
  }

  // Priority 8: No active program — free mode
  if (!input.hasProgram) {
    return makeHero('no-program', greeting,
      `Freestyle day, ${input.firstName}.`,
      'Scan any machine and start logging.',
      input.streak > 0
        ? { value: `${input.streak}`, label: 'day streak' }
        : undefined
    );
  }

  // Default: Morning, program ready, hasn't trained
  return makeHero('today-fresh', greeting,
    `Day ${input.programDayNumber ?? 1} is ready.`,
    `${input.programMachineCount ?? 0} machines · Est. ${input.programEstDuration ?? 30} min`,
    input.programTodaysFocus
      ? { value: input.programTodaysFocus, label: "today's focus" }
      : undefined
  );
}
