'use client';

import { CSSProperties } from 'react';
import type { DNAScores } from '@nexera/types';
import { DNA_AXES } from '@nexera/ai-assist';

interface DNARadarChartProps {
  scores: DNAScores;
  previousScores?: DNAScores;
  size?: 'compact' | 'full';
  showLabels?: boolean;
  showComparison?: boolean;
}

const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function polarToXY(angleDeg: number, radius: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function buildPolygonPoints(
  scores: DNAScores,
  maxRadius: number,
  cx: number,
  cy: number,
): string {
  return DNA_AXES.map((axis) => {
    const value = Math.max(0, Math.min(100, scores[axis.key]));
    const r = (value / 100) * maxRadius;
    const { x, y } = polarToXY(axis.angle, r, cx, cy);
    return `${x},${y}`;
  }).join(' ');
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

export function DNARadarChart({
  scores,
  previousScores,
  size = 'full',
  showLabels = true,
  showComparison = false,
}: DNARadarChartProps) {
  const dimensions = size === 'full' ? 320 : 160;
  const maxRadius = dimensions * 0.38;
  const cx = dimensions / 2;
  const cy = dimensions / 2;
  const labelOffset = maxRadius + (size === 'full' ? 38 : 18);
  const svgSize = dimensions + (showLabels && size === 'full' ? 80 : 20);
  const svgCenter = svgSize / 2;

  return (
    <div style={wrapperStyle}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{ overflow: 'visible' }}
        role="img"
        aria-label="DNA dimension radar chart"
      >
        <g transform={`translate(${svgCenter - cx}, ${svgCenter - cy})`}>
          {/* Grid lines */}
          {GRID_LEVELS.map((level) => {
            const pts = DNA_AXES.map((axis) => {
              const { x, y } = polarToXY(axis.angle, maxRadius * level, cx, cy);
              return `${x},${y}`;
            }).join(' ');
            return (
              <polygon
                key={level}
                points={pts}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            );
          })}

          {/* Axis lines */}
          {DNA_AXES.map((axis) => {
            const { x, y } = polarToXY(axis.angle, maxRadius, cx, cy);
            return (
              <line
                key={axis.key}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}

          {/* Previous scores polygon */}
          {showComparison && previousScores && (
            <polygon
              points={buildPolygonPoints(previousScores, maxRadius, cx, cy)}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Current scores polygon */}
          <polygon
            points={buildPolygonPoints(scores, maxRadius, cx, cy)}
            fill="rgba(255, 215, 0,0.12)"
            stroke="#FFD700"
            strokeWidth={2}
          />

          {/* Score dots */}
          {DNA_AXES.map((axis) => {
            const value = Math.max(0, Math.min(100, scores[axis.key]));
            const r = (value / 100) * maxRadius;
            const { x, y } = polarToXY(axis.angle, r, cx, cy);
            return <circle key={axis.key} cx={x} cy={y} r={4} fill="#FFD700" />;
          })}

          {/* Labels */}
          {showLabels &&
            DNA_AXES.map((axis) => {
              const { x, y } = polarToXY(axis.angle, labelOffset, cx, cy);
              const score = Math.round(scores[axis.key]);
              const fontSize = size === 'full' ? 11 : 8;
              return (
                <g key={`label-${axis.key}`}>
                  <text
                    x={x}
                    y={y - (size === 'full' ? 8 : 4)}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize={fontSize + 2}
                  >
                    {axis.icon}
                  </text>
                  <text
                    x={x}
                    y={y + (size === 'full' ? 6 : 4)}
                    textAnchor="middle"
                    fill="var(--color-text-secondary)"
                    fontSize={fontSize}
                    fontWeight={600}
                  >
                    {axis.label}
                  </text>
                  <text
                    x={x}
                    y={y + (size === 'full' ? 19 : 12)}
                    textAnchor="middle"
                    fill="#FFD700"
                    fontSize={fontSize}
                    fontWeight={700}
                  >
                    {score}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
}
