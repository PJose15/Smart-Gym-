'use client';

import { CSSProperties } from 'react';
import type { DNASnapshot } from '@nexera/types';

interface DNAHistoryChartProps {
  snapshots: DNASnapshot[];
}

const containerStyle: CSSProperties = {
  marginTop: 20,
};

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  margin: '0 0 12px',
};

function averageScore(snapshot: DNASnapshot): number {
  const s = snapshot.scores;
  return (s.power + s.consistency + s.progression + s.balance + s.mindset) / 5;
}

export function DNAHistoryChart({ snapshots }: DNAHistoryChartProps) {
  if (!snapshots || snapshots.length < 2) {
    return (
      <div style={containerStyle}>
        <h4 style={titleStyle}>12-Week Trend</h4>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Not enough data yet. Check back after a few weeks of training.
        </p>
      </div>
    );
  }

  const recent = snapshots.slice(-12);
  const width = 300;
  const height = 120;
  const padX = 30;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const avgs = recent.map(averageScore);
  const maxVal = 100;
  const stepX = recent.length > 1 ? plotW / (recent.length - 1) : 0;

  const points = avgs.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + plotH - (v / maxVal) * plotH;
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div style={containerStyle}>
      <h4 style={titleStyle}>12-Week Trend</h4>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="DNA score history chart">
        {/* Y-axis guides */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padY + plotH - (v / maxVal) * plotH;
          return (
            <g key={v}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
              <text x={padX - 4} y={y + 3} textAnchor="end" fill="var(--color-text-muted)" fontSize={9}>
                {v}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--accent, #E0142F)" strokeWidth={2} strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent-hover, #FF2740)" />
        ))}

        {/* X-axis week labels */}
        {points.map((p, i) => {
          if (recent.length <= 6 || i % 2 === 0 || i === recent.length - 1) {
            return (
              <text key={`x-${i}`} x={p.x} y={height - 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize={8}>
                W{i + 1}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
