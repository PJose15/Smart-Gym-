'use client';

import type { MuscleMapRecommendations as RecommendationsType, MuscleGroupKey, MuscleRecoveryState } from '@nexera/types';
import { MuscleChip } from './MuscleChip';

interface MuscleMapRecommendationsProps {
  recommendations: RecommendationsType;
  states: Record<MuscleGroupKey, MuscleRecoveryState>;
}

export function MuscleMapRecommendationsCard({
  recommendations,
  states,
}: MuscleMapRecommendationsProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Today&apos;s Recommendation</h3>

      <p className="text-sm text-gray-300">{recommendations.message}</p>

      {recommendations.suggestedFocus.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Suggested Focus</span>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.suggestedFocus.map(key => {
              const muscle = states[key];
              if (!muscle) return null;
              return <MuscleChip key={key} muscle={muscle} />;
            })}
          </div>
        </div>
      )}

      {recommendations.needsRecovery.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Needs Recovery</span>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.needsRecovery.slice(0, 6).map(key => {
              const muscle = states[key];
              if (!muscle) return null;
              return <MuscleChip key={key} muscle={muscle} />;
            })}
            {recommendations.needsRecovery.length > 6 && (
              <span className="text-xs text-gray-500 self-center">
                +{recommendations.needsRecovery.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
