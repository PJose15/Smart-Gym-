'use client';

import type { ReadinessZone } from '@nexera/types';
import { ZONE_COLORS } from '@nexera/ai-assist';

interface ReadinessArcProps {
  score: number;
  zone: ReadinessZone;
}

export function ReadinessArc({ score, zone }: ReadinessArcProps) {
  const SIZE = 120;
  const STROKE_WIDTH = 10;
  const RADIUS = (SIZE - STROKE_WIDTH) / 2;
  const CENTER = SIZE / 2;
  const ARC_DEGREES = 240;
  const START_ANGLE = 150;
  const CIRCUMFERENCE = (ARC_DEGREES / 360) * (2 * Math.PI * RADIUS);
  const fillLength = (score / 100) * CIRCUMFERENCE;

  const color = ZONE_COLORS[zone];

  return (
    <div className="relative">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {/* Background track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${CIRCUMFERENCE} ${2 * Math.PI * RADIUS}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
        />

        {/* Filled arc — hide at score 0 to prevent round-cap dot artifact */}
        {score > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${fillLength} ${CIRCUMFERENCE - fillLength}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
            style={{
              filter: zone === 'peak' ? `drop-shadow(0 0 6px ${color})` : 'none',
              transition: 'stroke-dasharray 1s ease-out',
            }}
          />
        )}

        {/* Score number in center */}
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="28"
          fontWeight="600"
        >
          {score}
        </text>
      </svg>
    </div>
  );
}
