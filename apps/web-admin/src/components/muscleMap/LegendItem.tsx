'use client';

import type { MuscleRecoveryStateLabel } from '@nexera/types';

// Colors come from the DOC_18 muscle-recovery tokens (styles/tokens.css) —
// crimson "primed", not the retired purple palette.
const LEGEND_CONFIG: Record<MuscleRecoveryStateLabel, { color: string; label: string; description: string }> = {
  fresh:      { color: 'var(--muscle-fresh, #00C896)',      label: 'Fresh',      description: 'Fully recovered' },
  primed:     { color: 'var(--muscle-primed, #E0142F)',     label: 'Primed',     description: 'Optimal window' },
  recovering: { color: 'var(--muscle-recovering, #FF7A90)', label: 'Recovering', description: 'Still recovering' },
  fatigued:   { color: 'var(--muscle-fatigued, #FFB020)',   label: 'Fatigued',   description: 'Needs rest' },
};

interface LegendItemProps {
  state: MuscleRecoveryStateLabel;
}

export function LegendItem({ state }: LegendItemProps) {
  const config = LEGEND_CONFIG[state];
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: config.color }}
      />
      <span className="text-xs text-gray-300">{config.label}</span>
      <span className="text-xs text-gray-500">— {config.description}</span>
    </div>
  );
}

export function MuscleMapLegend() {
  const states: MuscleRecoveryStateLabel[] = ['fresh', 'primed', 'recovering', 'fatigued'];
  return (
    <div className="flex flex-wrap gap-3">
      {states.map(s => <LegendItem key={s} state={s} />)}
    </div>
  );
}
