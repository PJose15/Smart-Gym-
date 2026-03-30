'use client';

import type { ReadinessResult } from '@nexera/types';

type WorkoutMode = 'free' | 'program';

interface ReadinessContextBannerProps {
  readiness: ReadinessResult;
  mode: WorkoutMode;
}

const BANNER_CONFIG = {
  peak: {
    icon: '\u26A1',
    message: 'Peak readiness — push for a PR today',
    className: 'border-green-800/30 bg-green-900/20',
  },
  ready: {
    icon: '\u2713',
    message: 'You are ready to train',
    className: 'border-blue-800/30 bg-blue-900/20',
  },
  moderate: {
    icon: '\u26A0',
    message: 'Lighter intensity recommended today',
    className: 'border-amber-800/30 bg-amber-900/20',
  },
  rest: {
    icon: '\u25CB',
    message: 'Rest day recommended — keep it light if you train',
    className: 'border-gray-700/30 bg-gray-800/20',
  },
} as const;

export function ReadinessContextBanner({
  readiness,
  mode,
}: ReadinessContextBannerProps) {
  const shouldShow =
    mode === 'free' ||
    readiness.zone === 'rest' ||
    readiness.zone === 'moderate';

  if (!shouldShow) return null;

  const config = BANNER_CONFIG[readiness.zone];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.className}`}
    >
      <span className="text-lg shrink-0">{config.icon}</span>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm font-medium text-white">{config.message}</span>
        <span className="text-xs text-gray-400 truncate">{readiness.subline}</span>
      </div>
      <div className="flex flex-col items-center shrink-0">
        <span
          className="text-lg font-bold"
          style={{ color: readiness.color }}
        >
          {readiness.score}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">readiness</span>
      </div>
    </div>
  );
}
