import type { DNADimensionScore } from '@nexera/types';

interface ProgressionInput {
  allSessions60d: Array<{
    machine_id: string | null;
    session_date: string;
    best_weight_lbs: number;
    total_volume_lbs: number;
  }>;
  programs: Array<{
    sessions_completed: number;
    sessions_total: number;
  }>;
  goals: Array<{
    is_achieved: boolean;
  }>;
}

/**
 * PROGRESSION dimension (0-100): Rate and consistency of improvement.
 *
 * Signal 1: Weight progression slope (40 pts max)
 * Signal 2: Program completion rate (30 pts max)
 * Signal 3: Goal achievement rate (30 pts max)
 */
export function calculateProgressionScore(input: ProgressionInput): DNADimensionScore {
  const { allSessions60d, programs, goals } = input;

  // Signal 1: Weight progression slope (40 pts max)
  const sessionsByMachine: Record<string, typeof allSessions60d> = {};
  for (const session of allSessions60d) {
    if (!session.machine_id) continue;
    if (!sessionsByMachine[session.machine_id]) {
      sessionsByMachine[session.machine_id] = [];
    }
    sessionsByMachine[session.machine_id].push(session);
  }

  const machineSlopes: number[] = [];
  for (const machineSessions of Object.values(sessionsByMachine)) {
    if (machineSessions.length < 3) continue;
    const withWeight = machineSessions.filter(s => s.best_weight_lbs > 0);
    if (withWeight.length < 3) continue;
    const slope = calculateWeightSlope(withWeight);
    machineSlopes.push(slope);
  }

  const avgSlope =
    machineSlopes.length > 0
      ? machineSlopes.reduce((a, b) => a + b, 0) / machineSlopes.length
      : 0;

  // avgSlope of +1 lb/session = 40 pts, 0 = 20 pts, -1 = 0 pts
  const slopeScore = Math.max(0, Math.min(40, Math.round(20 + avgSlope * 20)));

  // Signal 2: Program completion rate (30 pts max)
  let programScore = 15; // neutral if no programs
  if (programs.length > 0) {
    const completionRates = programs.map(p =>
      p.sessions_total > 0 ? p.sessions_completed / p.sessions_total : 0
    );
    const avgCompletionRate =
      completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
    programScore = Math.round(avgCompletionRate * 30);
  }

  // Signal 3: Goal achievement rate (30 pts max)
  let goalScore = 15; // neutral if no goals
  if (goals.length >= 2) {
    const achievedGoals = goals.filter(g => g.is_achieved).length;
    const achievementRate = achievedGoals / goals.length;
    goalScore = Math.round(achievementRate * 30);
  }

  const totalScore = Math.min(100, slopeScore + programScore + goalScore);

  return {
    score: totalScore,
    is_building: allSessions60d.length < 10,
    signals: {
      avg_weight_slope_per_session: Math.round(avgSlope * 10) / 10,
      machines_with_positive_trend: machineSlopes.filter(s => s > 0).length,
      program_completion_rate:
        programs.length > 0
          ? Math.round(
              (programs.reduce(
                (sum, p) => sum + (p.sessions_total > 0 ? p.sessions_completed / p.sessions_total : 0),
                0
              ) /
                programs.length) *
                100
            )
          : null,
      goals_achieved: goals.filter(g => g.is_achieved).length,
      goals_set: goals.length,
    },
  };
}

/**
 * Linear regression: y = weight, x = days since first session.
 * Returns slope (lbs per session-equivalent, scaled from time-based).
 */
export function calculateWeightSlope(
  sessions: Array<{ session_date: string; best_weight_lbs: number }>
): number {
  const n = sessions.length;
  if (n < 2) return 0;

  // Use actual dates for x-axis (days since first session)
  const dates = sessions.map(s => new Date(s.session_date).getTime());
  const minDate = Math.min(...dates);
  const msPerDay = 86400000;
  const x = dates.map(d => (d - minDate) / msPerDay);
  const y = sessions.map(s => s.best_weight_lbs);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  // slope is lbs/day; convert to approximate lbs/session
  const slopePerDay = (n * sumXY - sumX * sumY) / denominator;
  const totalDays = Math.max(1, x[x.length - 1] - x[0]);
  const avgDaysPerSession = totalDays / Math.max(1, n - 1);
  const slopePerSession = slopePerDay * avgDaysPerSession;

  return isNaN(slopePerSession) ? 0 : slopePerSession;
}
