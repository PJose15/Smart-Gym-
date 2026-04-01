'use client';

import { CSSProperties } from 'react';

interface GoalProgressMiniBarProps {
  current: number;
  target: number;
  unit?: string;
}

const trackStyle: CSSProperties = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  backgroundColor: 'rgba(59, 130, 246, 0.12)',
  overflow: 'hidden',
};

export function GoalProgressMiniBar({ current, target, unit = 'lbs' }: GoalProgressMiniBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  const fillStyle: CSSProperties = {
    width: `${pct}%`,
    height: '100%',
    borderRadius: 3,
    backgroundColor: pct >= 100 ? 'var(--color-green)' : 'var(--color-blue)',
    transition: 'width 0.4s ease',
  };

  return (
    <div>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 4,
        fontSize: 11,
        color: 'var(--color-text-secondary)',
      }}>
        <span>{current} {unit}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
