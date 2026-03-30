import type { MuscleGroupKey, MuscleMapResult } from '@nexera/types';

/**
 * Returns the most "primed" (ready-to-train) muscle group from the map.
 * This muscle gets the breathing animation on the ambient silhouette.
 *
 * Priority: primed muscles sorted by highest recoveryPct.
 * Fallback: fresh muscle with highest recoveryPct.
 * Returns null if no muscle data is available.
 */
export function getDominantMuscle(muscleMap: MuscleMapResult): MuscleGroupKey | null {
  const entries = Object.entries(muscleMap.states) as [MuscleGroupKey, (typeof muscleMap.states)[MuscleGroupKey]][];

  // Prefer primed muscles — most ready to train
  const primed = entries
    .filter(([, s]) => s.state === 'primed')
    .sort(([, a], [, b]) => b.recoveryPct - a.recoveryPct);

  if (primed.length > 0) return primed[0][0];

  // Fallback: most recovered fresh muscle
  const fresh = entries
    .filter(([, s]) => s.state === 'fresh')
    .sort(([, a], [, b]) => b.recoveryPct - a.recoveryPct);

  return fresh.length > 0 ? fresh[0][0] : null;
}
