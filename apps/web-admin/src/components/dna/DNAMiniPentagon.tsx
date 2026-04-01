'use client';

import type { DNAScores } from '@nexera/types';
import { DNA_AXES } from '@nexera/ai-assist';

interface DNAMiniPentagonProps {
  scores: DNAScores;
  archetypeColor: string;
  size: number;
  strokeWidth?: number;
  animated?: boolean;
  className?: string;
}

function polarToXY(angleDeg: number, radius: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function calculatePolygonPerimeter(points: { x: number; y: number }[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const dx = next.x - points[i].x;
    const dy = next.y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

export function DNAMiniPentagon({
  scores,
  archetypeColor,
  size,
  strokeWidth = 2,
  animated = false,
  className = '',
}: DNAMiniPentagonProps) {
  const color = archetypeColor || 'var(--color-text-secondary)';
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.42;
  const trackRadius = size * 0.44;

  // Calculate polygon points
  const points = DNA_AXES.map((axis) => {
    const value = Math.max(0, Math.min(100, scores[axis.key]));
    const minR = size * 0.08;
    const r = minR + (value / 100) * (maxRadius - minR);
    return polarToXY(axis.angle, r, cx, cy);
  });

  const polygonPath =
    'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ') + ' Z';

  const perimeter = calculatePolygonPerimeter(points);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={`dna-mini-pentagon ${animated ? 'animate' : ''} ${className}`.trim()}
      style={
        {
          '--path-length': perimeter,
        } as React.CSSProperties
      }
    >
      {/* Background circle track */}
      <circle
        cx={cx}
        cy={cy}
        r={trackRadius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />

      {/* Filled polygon */}
      <path
        d={polygonPath}
        fill={color + '1A'}
        className="pentagon-fill"
      />

      {/* Stroked polygon */}
      <path
        d={polygonPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        className="pentagon-stroke"
      />

      {/* Score dots */}
      {points.map((p, i) => (
        <circle
          key={DNA_AXES[i].key}
          cx={p.x}
          cy={p.y}
          r={size >= 56 ? 2.5 : 1.5}
          fill={color}
          className="pentagon-dot"
          style={
            animated
              ? { animationDelay: `${0.4 + i * 0.08}s` }
              : undefined
          }
        />
      ))}
    </svg>
  );
}
