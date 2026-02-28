/**
 * Builds a member context summary for AI coaching.
 * Pure function — no I/O, just computation from pre-fetched data.
 */

import { computeStreak } from './streaks';
import type { StreakResult } from './streaks';

// ─── Input Types ──────────────────────────────────────────

export interface MemberContextWorkout {
  id: string;
  started_at: string;
  finished_at: string | null;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{ weight_kg: number; reps: number }>;
  }>;
}

export interface MemberContextInput {
  workouts: MemberContextWorkout[];           // Last 30 days of completed workouts
  prs: Array<{ exercise_name: string }>;      // PRs hit in those workouts
  feedbackTrends: {
    discomfort_count: number;
    unstable_count: number;
    ok_count: number;
  };
  completedWorkoutDates: string[];            // All workout dates for streak calc
}

// ─── Output ───────────────────────────────────────────────

export interface MemberContext {
  summaryText: string;
  totalWorkouts30d: number;
  avgVolumePerSession: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable' | 'insufficient';
  gaps: string[];              // Areas that might need attention
  risks: string[];             // Safety / overtraining flags
  streak: StreakResult;
  recentPRs: string[];
}

// ─── Implementation ───────────────────────────────────────

export function buildMemberContext(input: MemberContextInput): MemberContext {
  const { workouts, prs, feedbackTrends, completedWorkoutDates } = input;

  const streak = computeStreak({ completedWorkoutDates });
  const totalWorkouts30d = workouts.length;
  const recentPRs = prs.map((p) => p.exercise_name);

  // Compute session volumes
  const sessionVolumes = workouts.map((w) => {
    let vol = 0;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        vol += s.weight_kg * s.reps;
      }
    }
    return vol;
  });

  const avgVolumePerSession =
    sessionVolumes.length > 0
      ? Math.round(sessionVolumes.reduce((a, b) => a + b, 0) / sessionVolumes.length)
      : 0;

  // Volume trend: compare first half vs second half
  let volumeTrend: MemberContext['volumeTrend'] = 'insufficient';
  if (sessionVolumes.length >= 4) {
    const mid = Math.floor(sessionVolumes.length / 2);
    const firstHalf = sessionVolumes.slice(0, mid);
    const secondHalf = sessionVolumes.slice(mid);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const change = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;
    if (change > 0.05) volumeTrend = 'increasing';
    else if (change < -0.05) volumeTrend = 'decreasing';
    else volumeTrend = 'stable';
  }

  // Identify gaps
  const gaps: string[] = [];
  if (totalWorkouts30d === 0) {
    gaps.push('No workouts in the last 30 days');
  } else if (totalWorkouts30d < 4) {
    gaps.push('Low training frequency (less than once per week)');
  }
  if (volumeTrend === 'decreasing') {
    gaps.push('Volume has been declining recently');
  }
  if (!streak.currentWeekActive && streak.currentStreak > 0) {
    gaps.push('Haven\'t trained yet this week — streak at risk');
  }

  // Identify risks
  const risks: string[] = [];
  const totalFeedback = feedbackTrends.discomfort_count + feedbackTrends.unstable_count + feedbackTrends.ok_count;
  if (totalFeedback > 0) {
    const discomfortRate = feedbackTrends.discomfort_count / totalFeedback;
    if (discomfortRate > 0.2) {
      risks.push('High discomfort rate — consider lighter loads or form review');
    }
    const unstableRate = feedbackTrends.unstable_count / totalFeedback;
    if (unstableRate > 0.3) {
      risks.push('Frequent instability reports — may need technique adjustments');
    }
  }

  // Check for overtraining (7+ workouts in 7 days)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const workoutsThisWeek = workouts.filter(
    (w) => new Date(w.started_at) >= oneWeekAgo,
  ).length;
  if (workoutsThisWeek >= 7) {
    risks.push('Training every day — rest days are important for recovery');
  }

  // Build summary text
  const lines: string[] = [];
  lines.push(`${totalWorkouts30d} workouts in the last 30 days.`);
  if (avgVolumePerSession > 0) {
    lines.push(`Average volume: ${avgVolumePerSession.toLocaleString()}kg per session.`);
  }
  if (volumeTrend !== 'insufficient') {
    lines.push(`Volume trend: ${volumeTrend}.`);
  }
  if (streak.currentStreak > 0) {
    lines.push(`Current streak: ${streak.currentStreak} weeks.`);
  }
  if (recentPRs.length > 0) {
    lines.push(`Recent PRs: ${recentPRs.slice(0, 3).join(', ')}.`);
  }
  if (gaps.length > 0) {
    lines.push(`Areas to address: ${gaps.join('; ')}.`);
  }
  if (risks.length > 0) {
    lines.push(`Risks: ${risks.join('; ')}.`);
  }

  return {
    summaryText: lines.join(' '),
    totalWorkouts30d,
    avgVolumePerSession,
    volumeTrend,
    gaps,
    risks,
    streak,
    recentPRs,
  };
}
