'use client';

import type { ReadinessResult } from '@nexera/types';
import { ReadinessDot } from './ReadinessDot';
import { ReadinessArc } from './ReadinessArc';

interface ReadinessIndicatorProps {
  readiness: ReadinessResult;
  size?: 'compact' | 'full';
}

export function ReadinessIndicator({
  readiness,
  size = 'compact',
}: ReadinessIndicatorProps) {
  if (size === 'compact') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-full border"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <ReadinessDot zone={readiness.zone} />
        <span
          className="text-sm font-bold"
          style={{ color: readiness.color }}
        >
          {readiness.score}
        </span>
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          {readiness.zone}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ReadinessArc score={readiness.score} zone={readiness.zone} />
      <div className="flex flex-col gap-1">
        <span className="text-white font-semibold">{readiness.headline}</span>
        <span className="text-sm text-gray-400">{readiness.subline}</span>
      </div>
    </div>
  );
}
