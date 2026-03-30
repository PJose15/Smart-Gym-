// ─── Hero State Computation ─────────────────────────────
// Pure function — determines which hero variant to show on the member home screen.
// Priority order: checkin-coming > level-up > program-complete > pr-recent >
//                 streak-milestone > comeback > program-week > today-trained >
//                 no-program > today-fresh

import { checkSundayAnticipation } from './sundayAnticipation';

export type HeroVariant =
  | 'checkin-coming'
  | 'level-up'
  | 'program-complete'
  | 'pr-recent'
  | 'streak-milestone'
  | 'comeback'
  | 'program-week'
  | 'today-trained'
  | 'no-program'
  | 'today-fresh';

export interface HeroState {
  variant: HeroVariant;
  greeting: string;
  headline: string;
  subline: string;
  metric: string | null;
  gradient: string; // CSS gradient
  accent: string; // CSS color
}

export interface HeroInput {
  firstName: string;
  /** Whether the member leveled up since their last visit */
  leveledUp: boolean;
  /** New level name (if leveled up) */
  newLevelName: string | null;
  /** New level number (if leveled up) */
  newLevelNumber: number | null;
  /** Whether the active program is 100% complete */
  programComplete: boolean;
  /** Program name (if any) */
  programName: string | null;
  /** Whether the member hit a PR in the last 24 hours */
  recentPR: boolean;
  /** PR exercise name */
  prExercise: string | null;
  /** Current streak in weeks */
  currentStreak: number;
  /** Days since last workout (null if never worked out) */
  daysSinceLastWorkout: number | null;
  /** Whether the member has an active program */
  hasProgram: boolean;
  /** Current week number in the program */
  programWeek: number | null;
  /** Total program weeks */
  programTotalWeeks: number | null;
  /** Whether the member already trained today */
  trainedToday: boolean;
  /** Today's session count */
  todaySessions: number;
  /** Whether the member has an unread check-in */
  hasUnreadCheckIn?: boolean;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Computes the hero state for the member home screen.
 * Returns the highest-priority variant that matches the member's current state.
 */
export function computeHeroState(input: HeroInput): HeroState {
  const greet = `${timeGreeting()}, ${input.firstName}`;

  // 0. Sunday Anticipation — check-in arriving soon (UI_009)
  const sunday = checkSundayAnticipation();
  if (sunday.anticipating && !input.hasUnreadCheckIn) {
    return {
      variant: 'checkin-coming',
      greeting: `Sunday evening, ${input.firstName}.`,
      headline: 'Your check-in arrives at 6pm.',
      subline: 'Your Nexera Coach is reviewing your week.',
      metric: `${sunday.minutesUntil}m`,
      gradient: 'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)',
      accent: '#FCD34D',
    };
  }

  // 1. Level Up
  if (input.leveledUp && input.newLevelName != null && input.newLevelNumber != null) {
    return {
      variant: 'level-up',
      greeting: greet,
      headline: `Level ${input.newLevelNumber}: ${input.newLevelName}`,
      subline: 'Your hard work just paid off!',
      metric: `Level ${input.newLevelNumber}`,
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
      accent: '#A78BFA',
    };
  }

  // 2. Program Complete
  if (input.programComplete && input.programName) {
    return {
      variant: 'program-complete',
      greeting: greet,
      headline: 'Program Complete!',
      subline: `You finished ${input.programName}. Time for a new challenge.`,
      metric: null,
      gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)',
      accent: '#6EE7B7',
    };
  }

  // 3. Recent PR
  if (input.recentPR && input.prExercise) {
    return {
      variant: 'pr-recent',
      greeting: greet,
      headline: 'New Personal Record!',
      subline: `You crushed it on ${input.prExercise}.`,
      metric: 'PR',
      gradient: 'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)',
      accent: '#FCD34D',
    };
  }

  // 4. Streak Milestone (4, 8, 12, 16, 20, ...) — only if recently active
  if (input.currentStreak > 0 && input.currentStreak % 4 === 0 && (input.daysSinceLastWorkout === null || input.daysSinceLastWorkout <= 14)) {
    return {
      variant: 'streak-milestone',
      greeting: greet,
      headline: `${input.currentStreak}-Week Streak!`,
      subline: 'Consistency is your superpower.',
      metric: `${input.currentStreak}w`,
      gradient: 'linear-gradient(135deg, #EA580C 0%, #FB923C 100%)',
      accent: '#FDBA74',
    };
  }

  // 5. Comeback (>14 days since last workout)
  if (input.daysSinceLastWorkout !== null && input.daysSinceLastWorkout > 14) {
    return {
      variant: 'comeback',
      greeting: `Welcome back, ${input.firstName}`,
      headline: 'Great to See You!',
      subline: "Every comeback starts with one session. Let's go.",
      metric: null,
      gradient: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
      accent: '#93C5FD',
    };
  }

  // 6. Program Week (has active program, not today-trained)
  if (input.hasProgram && input.programWeek != null && input.programWeek > 0 && input.programTotalWeeks != null && input.programTotalWeeks > 0 && !input.trainedToday) {
    return {
      variant: 'program-week',
      greeting: greet,
      headline: `Week ${input.programWeek} of ${input.programTotalWeeks}`,
      subline: input.programName ? `${input.programName} — keep it rolling.` : 'Your program awaits.',
      metric: `${input.programWeek}/${input.programTotalWeeks}`,
      gradient: 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)',
      accent: '#67E8F9',
    };
  }

  // 7. Today Trained (already has sessions today)
  if (input.trainedToday) {
    return {
      variant: 'today-trained',
      greeting: greet,
      headline: 'Nice Work Today!',
      subline: input.todaySessions === 1
        ? 'You logged 1 session so far.'
        : `You logged ${input.todaySessions} sessions so far.`,
      metric: `${input.todaySessions}`,
      gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      accent: '#34D399',
    };
  }

  // 8. No Program (never had a program)
  if (!input.hasProgram) {
    return {
      variant: 'no-program',
      greeting: greet,
      headline: "Let's Get Started",
      subline: 'Scan a machine to begin your first session.',
      metric: null,
      gradient: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
      accent: '#94A3B8',
    };
  }

  // 9. Today Fresh (default — has program but hasn't trained today)
  return {
    variant: 'today-fresh',
    greeting: greet,
    headline: 'Ready to Train?',
    subline: input.programName ? `${input.programName} is waiting for you.` : "Today's session is waiting.",
    metric: null,
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
    accent: '#60A5FA',
  };
}
