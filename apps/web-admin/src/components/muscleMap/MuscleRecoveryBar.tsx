'use client';

import type { MuscleRecoveryState } from '@nexera/types';

interface MuscleRecoveryBarProps {
  muscle: MuscleRecoveryState;
}

export function MuscleRecoveryBar({ muscle }: MuscleRecoveryBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-24 truncate">{muscle.label}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${muscle.recoveryPct}%`,
            backgroundColor: muscle.color,
          }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">
        {muscle.recoveryPct}%
      </span>
    </div>
  );
}
