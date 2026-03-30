'use client';

import type { MuscleGroupKey, MuscleRecoveryState, BodySide } from '@nexera/types';
import { FRONT_PATHS, BACK_PATHS, BODY_OUTLINE_FRONT, BODY_OUTLINE_BACK } from './musclePaths';

interface MuscleMapSVGProps {
  side: BodySide;
  states: Record<MuscleGroupKey, MuscleRecoveryState>;
  selectedMuscle?: MuscleGroupKey | null;
  onMusclePress?: (key: MuscleGroupKey) => void;
  width?: number;
  height?: number;
}

export function MuscleMapSVG({
  side,
  states,
  selectedMuscle,
  onMusclePress,
  width = 200,
  height = 400,
}: MuscleMapSVGProps) {
  const paths = side === 'front' ? FRONT_PATHS : BACK_PATHS;
  const outline = side === 'front' ? BODY_OUTLINE_FRONT : BODY_OUTLINE_BACK;

  return (
    <svg
      viewBox="0 0 200 400"
      width={width}
      height={height}
      className="select-none"
    >
      {/* Body silhouette */}
      <path
        d={outline}
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />

      {/* Muscle groups */}
      {paths.map((path) => {
        const state = states[path.key];
        if (!state) return null;

        const isSelected = selectedMuscle === path.key;
        const opacity = isSelected ? 0.9 : 0.6;
        const strokeWidth = isSelected ? 2 : 0.5;

        return (
          <path
            key={path.key}
            d={path.d}
            fill={state.color}
            fillOpacity={opacity}
            stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.2)'}
            strokeWidth={strokeWidth}
            className="cursor-pointer transition-all duration-200"
            onClick={() => onMusclePress?.(path.key)}
          />
        );
      })}
    </svg>
  );
}
