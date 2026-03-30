'use client';

import type { MuscleRecoveryStateLabel } from '@nexera/types';

const PILL_CONFIG: Record<MuscleRecoveryStateLabel, { bg: string; text: string; label: string }> = {
  fresh:      { bg: 'bg-green-900/30',  text: 'text-green-400',  label: 'Fresh' },
  primed:     { bg: 'bg-blue-900/30',   text: 'text-blue-400',   label: 'Primed' },
  recovering: { bg: 'bg-orange-900/30', text: 'text-orange-400', label: 'Recovering' },
  fatigued:   { bg: 'bg-red-900/30',    text: 'text-red-400',    label: 'Fatigued' },
};

interface RecoveryStatePillProps {
  state: MuscleRecoveryStateLabel;
  size?: 'sm' | 'md';
}

export function RecoveryStatePill({ state, size = 'sm' }: RecoveryStatePillProps) {
  const config = PILL_CONFIG[state];
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      {config.label}
    </span>
  );
}
