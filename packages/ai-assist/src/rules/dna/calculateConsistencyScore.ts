import type { DNADimensionScore } from '@nexera/types';

interface ConsistencyInput {
  sessionDatesLast30: string[];
  currentStreak: number;
  bestStreak: number;
  readinessEntries: Array<{ score: number; zone: string }>;
}

/**
 * CONSISTENCY dimension (0-100): How reliably the member trains.
 *
 * Signal 1: Session frequency (35 pts max)
 * Signal 2: Streak quality (35 pts max)
 * Signal 3: Readiness-aware training (30 pts max)
 */
export function calculateConsistencyScore(input: ConsistencyInput): DNADimensionScore {
  const { sessionDatesLast30, currentStreak, bestStreak, readinessEntries } = input;

  const uniqueDates = [...new Set(sessionDatesLast30)];
  const sessionCount = uniqueDates.length;

  // Signal 1: Session frequency (35 pts max)
  // Target: 3x/week = ~12-13 sessions in 30 days
  const sessionsPerWeek = (sessionCount / 30) * 7;
  const frequencyScore = Math.min(35, Math.round(sessionsPerWeek * (35 / 3)));

  // Signal 2: Streak quality (35 pts max)
  // Current streak weighted 70%, best streak 30%
  const streakScore = Math.min(
    35,
    Math.round(((currentStreak * 0.7 + bestStreak * 0.3) / 30) * 35)
  );

  // Signal 3: Readiness-aware training (30 pts max)
  // Rewards members who still train on days with moderate/rest readiness.
  // If no readiness data exists, give a neutral score.
  let readinessCommitmentScore: number;
  if (readinessEntries.length === 0) {
    readinessCommitmentScore = 15; // neutral — no readiness data
  } else {
    const hardDays = readinessEntries.filter(
      r => r.zone === 'moderate' || r.zone === 'rest'
    );
    if (hardDays.length === 0) {
      // All peak readiness — reward for healthy training
      readinessCommitmentScore = 20;
    } else {
      // Credit based on training despite hard days:
      // Having hard days AND still maintaining session frequency shows commitment.
      // Scale by how many sessions they still got in relative to hard days.
      const hardDayRatio = hardDays.length / readinessEntries.length;
      const trainingDespiteHardness = Math.min(1, sessionCount / (hardDays.length * 2));
      readinessCommitmentScore = Math.min(
        30,
        Math.round(hardDayRatio * trainingDespiteHardness * 30 + 10)
      );
    }
  }

  const totalScore = Math.min(100, frequencyScore + streakScore + readinessCommitmentScore);

  return {
    score: totalScore,
    is_building: sessionCount < 8,
    signals: {
      sessions_this_month: sessionCount,
      sessions_per_week: Math.round(sessionsPerWeek * 10) / 10,
      current_streak: currentStreak,
      best_streak: bestStreak,
    },
  };
}
