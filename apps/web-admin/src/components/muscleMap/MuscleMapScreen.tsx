'use client';

import { useState } from 'react';
import type { MuscleMapResult, MuscleGroupKey, BodySide } from '@nexera/types';
import { MuscleMapSVG } from './MuscleMapSVG';
import { MuscleMapLegend } from './LegendItem';
import { MuscleDetailCard } from './MuscleDetailCard';
import { MuscleMapRecommendationsCard } from './MuscleMapRecommendations';

interface MuscleMapScreenProps {
  data: MuscleMapResult;
}

export function MuscleMapScreen({ data }: MuscleMapScreenProps) {
  const [side, setSide] = useState<BodySide>('front');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupKey | null>(null);

  const selectedState = selectedMuscle ? data.states[selectedMuscle] : null;

  return (
    <div className="space-y-4">
      {/* Balance Score Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Muscle Map</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Balance</span>
          <span className="text-sm font-bold text-white">{data.balanceScore}</span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${data.balanceScore}%`,
                backgroundColor: data.balanceScore >= 70 ? '#00C896' : data.balanceScore >= 40 ? '#FFB020' : '#FF4D6A',
              }}
            />
          </div>
        </div>
      </div>

      {/* Front/Back Toggle */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
        {(['front', 'back'] as BodySide[]).map(s => (
          <button
            type="button"
            key={s}
            onClick={() => { setSide(s); setSelectedMuscle(null); }}
            className={`
              flex-1 py-1.5 text-xs font-medium rounded-md transition-all
              ${side === s ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-gray-300'}
            `}
          >
            {s === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>

      {/* Body Map */}
      <div className="flex justify-center">
        <MuscleMapSVG
          side={side}
          states={data.states}
          selectedMuscle={selectedMuscle}
          onMusclePress={key =>
            setSelectedMuscle(prev => prev === key ? null : key)
          }
          width={180}
          height={360}
        />
      </div>

      {/* Legend */}
      <MuscleMapLegend />

      {/* Detail Card */}
      {selectedState && (
        <MuscleDetailCard
          muscle={selectedState}
          onClose={() => setSelectedMuscle(null)}
        />
      )}

      {/* Recommendations */}
      <MuscleMapRecommendationsCard
        recommendations={data.recommendations}
        states={data.states}
      />
    </div>
  );
}
