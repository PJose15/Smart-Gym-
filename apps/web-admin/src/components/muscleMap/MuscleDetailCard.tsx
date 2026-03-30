'use client';

import type { MuscleRecoveryState } from '@nexera/types';
import { RecoveryStatePill } from './RecoveryStatePill';
import { MuscleRecoveryBar } from './MuscleRecoveryBar';

interface MuscleDetailCardProps {
  muscle: MuscleRecoveryState;
  onClose?: () => void;
}

export function MuscleDetailCard({ muscle, onClose }: MuscleDetailCardProps) {
  const hoursText = muscle.hoursSinceTraining !== null
    ? muscle.hoursSinceTraining < 24
      ? `${muscle.hoursSinceTraining}h ago`
      : `${Math.floor(muscle.hoursSinceTraining / 24)}d ago`
    : 'Never trained';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: muscle.color }}
          />
          <span className="text-white font-semibold">{muscle.label}</span>
          <RecoveryStatePill state={muscle.state} />
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      <MuscleRecoveryBar muscle={muscle} />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Last trained: {hoursText}</span>
        <span>Recovery: {muscle.recoveryPct}%</span>
      </div>
    </div>
  );
}
