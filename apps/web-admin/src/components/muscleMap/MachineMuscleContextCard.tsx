'use client';

import type { MuscleGroupKey, MuscleRecoveryState } from '@nexera/types';
import { MuscleChip } from './MuscleChip';
import { RecoveryStatePill } from './RecoveryStatePill';

interface MachineMuscleContextCardProps {
  machineName: string;
  primaryMuscles: MuscleGroupKey[];
  secondaryMuscles: MuscleGroupKey[];
  states: Record<MuscleGroupKey, MuscleRecoveryState>;
}

/**
 * Shown during a workout when scanning a machine.
 * Displays which muscles this machine targets and their current recovery state.
 */
export function MachineMuscleContextCard({
  machineName,
  primaryMuscles,
  secondaryMuscles,
  states,
}: MachineMuscleContextCardProps) {
  const hasFatigued = [...primaryMuscles, ...secondaryMuscles].some(
    k => states[k]?.state === 'fatigued'
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{machineName}</h3>
        {hasFatigued && (
          <span className="text-xs text-red-400">Fatigued muscles involved</span>
        )}
      </div>

      {primaryMuscles.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Primary</span>
          <div className="flex flex-wrap gap-1.5">
            {primaryMuscles.map(key => {
              const state = states[key];
              return state ? (
                <div key={key} className="flex items-center gap-1">
                  <MuscleChip muscle={state} />
                  <RecoveryStatePill state={state.state} />
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {secondaryMuscles.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Secondary</span>
          <div className="flex flex-wrap gap-1.5">
            {secondaryMuscles.map(key => {
              const state = states[key];
              return state ? (
                <MuscleChip key={key} muscle={state} />
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
