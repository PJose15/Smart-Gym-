import type { DNADimensionScore } from '@nexera/types';

interface PowerInput {
  recentSessions: Array<{
    machine_id: string | null;
    best_weight_lbs: number;
    total_volume_lbs: number;
  }>;
  olderSessions: Array<{
    machine_id: string | null;
    best_weight_lbs: number;
  }>;
}

/**
 * POWER dimension (0-100): Strength relative to training history.
 *
 * Signal 1: PR frequency (30 pts max)
 * Signal 2: Weight progression vs previous 30 days (40 pts max)
 * Signal 3: Volume intensity (30 pts max)
 */
export function calculatePowerScore(input: PowerInput): DNADimensionScore {
  const { recentSessions, olderSessions } = input;

  if (recentSessions.length === 0) {
    return { score: 0, is_building: true, signals: {} };
  }

  // Signal 1: PR frequency (30 pts max)
  // Sessions with a best_weight_lbs > 0 are considered PR-relevant
  const prCount = recentSessions.filter(s => s.best_weight_lbs > 0).length;
  const prRate = prCount / recentSessions.length;
  // 50% PR rate = 30 points (max)
  const prScore = Math.min(30, Math.round(prRate * 60));

  // Signal 2: Weight progression vs previous 30 days (40 pts max)
  const recentByMachine: Record<string, number> = {};
  const olderByMachine: Record<string, number> = {};

  for (const session of recentSessions) {
    if (!session.machine_id || !session.best_weight_lbs) continue;
    const existing = recentByMachine[session.machine_id] ?? 0;
    if (session.best_weight_lbs > existing) {
      recentByMachine[session.machine_id] = session.best_weight_lbs;
    }
  }

  for (const session of olderSessions) {
    if (!session.machine_id || !session.best_weight_lbs) continue;
    const existing = olderByMachine[session.machine_id] ?? 0;
    if (session.best_weight_lbs > existing) {
      olderByMachine[session.machine_id] = session.best_weight_lbs;
    }
  }

  const machineProgression: number[] = [];
  for (const [machineId, recentBest] of Object.entries(recentByMachine)) {
    const olderBest = olderByMachine[machineId];
    if (!olderBest) continue;
    const progressionPct = ((recentBest - olderBest) / olderBest) * 100;
    machineProgression.push(progressionPct);
  }

  let progressionScore = 20; // baseline — holding steady
  if (machineProgression.length > 0) {
    const avgProgression =
      machineProgression.reduce((a, b) => a + b, 0) / machineProgression.length;
    // +5% avg weight increase = full 40 points
    // 0% = 20 points (holding steady)
    // -5% avg = 0 points (regressing)
    progressionScore = Math.max(0, Math.min(40, Math.round(20 + (avgProgression / 5) * 20)));
  }

  // Signal 3: Volume intensity (30 pts max)
  const totalVolume = recentSessions.reduce((sum, s) => sum + (s.total_volume_lbs ?? 0), 0);
  const avgVolume = totalVolume / recentSessions.length;

  const volumeScore = Math.min(30,
    avgVolume < 500
      ? Math.round(avgVolume / 50)
      : avgVolume < 1000
        ? 10 + Math.round((avgVolume - 500) / 50)
        : avgVolume < 2000
          ? 20 + Math.round((avgVolume - 1000) / 200)
          : 25 + Math.min(5, Math.round((avgVolume - 2000) / 400))
  );

  const totalScore = Math.min(100, prScore + progressionScore + volumeScore);

  return {
    score: totalScore,
    is_building: recentSessions.length < 5,
    signals: {
      pr_rate: Math.round(prRate * 100),
      avg_progression_pct:
        machineProgression.length > 0
          ? Math.round(
              (machineProgression.reduce((a, b) => a + b, 0) / machineProgression.length) * 10
            ) / 10
          : null,
      avg_volume_per_session: Math.round(avgVolume),
    },
  };
}
