'use client';

import { CSSProperties } from 'react';

/**
 * Superset of the codebase's MuscleRecoveryStateLabel — DOC_03 §13 also
 * specifies a 'trained' state, so accept it here for forward-compat.
 */
export type AmbientRecoveryState = 'fresh' | 'primed' | 'trained' | 'fatigued' | 'recovering';

interface AmbientGlowProps {
  /** e.g. ['chest', 'triceps', 'shoulders'] — first muscle drives the glow */
  primaryMuscles: string[];
  /** Recovery state per muscle. Unknown muscles default to 'fresh'. */
  recoveryStates?: Record<string, AmbientRecoveryState>;
}

/** Recovery state → ambient glow rgba — DOC_03 Section 13 */
const AMBIENT_COLORS: Record<AmbientRecoveryState, string> = {
  fresh: 'rgba(0, 200, 150, 0.15)', // green glow
  primed: 'rgba(124, 92, 255, 0.15)', // purple glow — optimal
  trained: 'rgba(59, 130, 246, 0.12)', // blue glow
  fatigued: 'rgba(255, 176, 32, 0.10)', // warning glow
  recovering: 'rgba(255, 77, 106, 0.08)', // light red glow
};

export function getAmbientColor(
  muscle: string | undefined,
  states: Record<string, AmbientRecoveryState> = {}
): string {
  const state: AmbientRecoveryState = (muscle && states[muscle]) || 'fresh';
  return AMBIENT_COLORS[state] ?? AMBIENT_COLORS.fresh;
}

/**
 * Machine-page ambient glow — DOC_03 Section 13.
 *
 * A very subtle radial gradient positioned behind the machine detail card,
 * colored by the recovery state of the primary muscle this machine targets.
 * Breathes on a 4s loop (`ambient-breathe` in animations.css). Purely
 * decorative: pointer-events none, aria-hidden, z-index 0 — the parent must
 * be position: relative with content above z-index 0.
 *
 * (Home-hero equivalent: HeroMuscleAmbient — body-silhouette variant.)
 */
export function AmbientGlow({ primaryMuscles, recoveryStates = {} }: AmbientGlowProps) {
  const color = getAmbientColor(primaryMuscles[0], recoveryStates);

  return (
    <div
      className="machine-ambient"
      aria-hidden="true"
      style={{ '--ambient-color': color } as CSSProperties}
    />
  );
}
