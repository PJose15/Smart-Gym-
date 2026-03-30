'use client';

import type { MuscleRecoveryState } from '@nexera/types';

interface MuscleChipProps {
  muscle: MuscleRecoveryState;
  selected?: boolean;
  onClick?: () => void;
}

export function MuscleChip({ muscle, selected, onClick }: MuscleChipProps) {
  return (
    <button
      type="button"
      aria-label={muscle.label}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        transition-all duration-150 border
        ${selected
          ? 'border-white/30 bg-white/10'
          : 'border-white/10 bg-white/5 hover:bg-white/8'
        }
      `}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: muscle.color }}
      />
      <span className="text-gray-200">{muscle.label}</span>
    </button>
  );
}
