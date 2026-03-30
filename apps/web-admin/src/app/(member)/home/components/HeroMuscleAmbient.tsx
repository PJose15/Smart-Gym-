'use client';

import type { MuscleMapResult, MuscleGroupKey, MuscleRecoveryStateLabel } from '@nexera/types';
import { getDominantMuscle } from '@/lib/muscleMap/getDominantMuscle';

interface HeroMuscleAmbientProps {
  muscleMap: MuscleMapResult | null;
}

/** Recovery state → opacity (lower = more ambient) */
const STATE_OPACITY: Record<MuscleRecoveryStateLabel, number> = {
  fresh:      0.06,
  primed:     0.14,
  recovering: 0.10,
  fatigued:   0.08,
};

function getMuscleStyle(
  states: MuscleMapResult['states'],
  muscle: MuscleGroupKey,
  dominant: MuscleGroupKey | null,
) {
  const s = states[muscle];
  if (!s) return { fill: 'transparent', fillOpacity: 0 };
  return {
    fill: s.color,
    fillOpacity: STATE_OPACITY[s.state] ?? 0.06,
    className: dominant === muscle ? 'dominant-region' : undefined,
    style: dominant === muscle ? { '--ambient-opacity': STATE_OPACITY[s.state] ?? 0.12 } as React.CSSProperties : undefined,
  };
}

/**
 * Faint, abstract muscle silhouette behind the hero zone.
 * Each region glows in its recovery state color at very low opacity.
 * Pure decoration — no interaction, no a11y cost.
 */
export function HeroMuscleAmbient({ muscleMap }: HeroMuscleAmbientProps) {
  if (!muscleMap) return null;

  const { states } = muscleMap;
  const dominant = getDominantMuscle(muscleMap);

  return (
    <div className="hero-muscle-ambient" aria-hidden="true">
      <svg
        viewBox="0 0 120 240"
        width="120"
        height="240"
        className="hero-ambient-svg"
      >
        {/* Head (neutral, not a muscle group) */}
        <ellipse cx="60" cy="18" rx="16" ry="18"
          fill="rgba(255,255,255,0.08)"
          fillOpacity={0.06}
        />

        {/* Chest */}
        <rect x="36" y="42" width="48" height="28" rx="8"
          {...getMuscleStyle(states, 'chest', dominant)}
        />

        {/* Front Delts (shoulders) */}
        <ellipse cx="28" cy="50" rx="10" ry="14"
          {...getMuscleStyle(states, 'front_delts', dominant)}
        />
        <ellipse cx="92" cy="50" rx="10" ry="14"
          {...getMuscleStyle(states, 'front_delts', dominant)}
        />

        {/* Side Delts */}
        <ellipse cx="20" cy="48" rx="7" ry="10"
          {...getMuscleStyle(states, 'side_delts', dominant)}
        />
        <ellipse cx="100" cy="48" rx="7" ry="10"
          {...getMuscleStyle(states, 'side_delts', dominant)}
        />

        {/* Biceps */}
        <rect x="16" y="68" width="16" height="32" rx="8"
          {...getMuscleStyle(states, 'biceps', dominant)}
        />
        <rect x="88" y="68" width="16" height="32" rx="8"
          {...getMuscleStyle(states, 'biceps', dominant)}
        />

        {/* Abs / Core */}
        <rect x="42" y="76" width="36" height="40" rx="6"
          {...getMuscleStyle(states, 'abs', dominant)}
        />

        {/* Quads */}
        <rect x="36" y="130" width="20" height="52" rx="8"
          {...getMuscleStyle(states, 'quads', dominant)}
        />
        <rect x="64" y="130" width="20" height="52" rx="8"
          {...getMuscleStyle(states, 'quads', dominant)}
        />

        {/* Calves */}
        <rect x="38" y="192" width="16" height="36" rx="8"
          {...getMuscleStyle(states, 'calves', dominant)}
        />
        <rect x="66" y="192" width="16" height="36" rx="8"
          {...getMuscleStyle(states, 'calves', dominant)}
        />
      </svg>
    </div>
  );
}
