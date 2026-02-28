// ─── Badge Unlock Engine ────────────────────────────────
// Pure function — no Supabase dependency. Pass stats in, get newly unlocked badge slugs out.

export interface BadgeCheckInput {
  completedWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  totalVolumeKg: number;
  totalPRs: number;
  totalPoints: number;
  alreadyUnlockedSlugs: string[];
}

interface BadgeRule {
  slug: string;
  check: (input: BadgeCheckInput) => boolean;
}

const BADGE_RULES: BadgeRule[] = [
  { slug: 'first_workout',      check: (i) => i.completedWorkouts >= 1 },
  { slug: 'workouts_10',        check: (i) => i.completedWorkouts >= 10 },
  { slug: 'workouts_50',        check: (i) => i.completedWorkouts >= 50 },
  { slug: 'workouts_100',       check: (i) => i.completedWorkouts >= 100 },
  { slug: 'streak_4',           check: (i) => i.longestStreak >= 4 },
  { slug: 'streak_12',          check: (i) => i.longestStreak >= 12 },
  { slug: 'total_volume_10k',   check: (i) => i.totalVolumeKg >= 10000 },
  { slug: 'total_volume_100k',  check: (i) => i.totalVolumeKg >= 100000 },
  { slug: 'prs_5',              check: (i) => i.totalPRs >= 5 },
  { slug: 'prs_25',             check: (i) => i.totalPRs >= 25 },
  { slug: 'points_500',         check: (i) => i.totalPoints >= 500 },
  { slug: 'points_5000',        check: (i) => i.totalPoints >= 5000 },
];

/**
 * Checks which badges should be unlocked based on the user's current stats.
 * Returns an array of badge slugs that are newly eligible (not already unlocked).
 */
export function checkBadgeUnlocks(input: BadgeCheckInput): string[] {
  const alreadySet = new Set(input.alreadyUnlockedSlugs);

  return BADGE_RULES
    .filter((rule) => !alreadySet.has(rule.slug) && rule.check(input))
    .map((rule) => rule.slug);
}
