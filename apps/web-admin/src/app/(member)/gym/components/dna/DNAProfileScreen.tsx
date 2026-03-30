'use client';

import { CSSProperties, useState } from 'react';
import type { DNADimension } from '@nexera/types';
import { DNA_AXES, DIMENSION_CONFIG } from '@nexera/ai-assist';
import { useDNA } from '@/lib/hooks/useDNA';
import { DNASkeleton } from './DNASkeleton';
import { DNABuildingState } from './DNABuildingState';
import { DNAArchetypeCard } from './DNAArchetypeCard';
import { DNARadarChart } from './DNARadarChart';
import { DNADimensionRow } from './DNADimensionRow';
import { DNAHistoryChart } from './DNAHistoryChart';

interface DNAProfileScreenProps {
  memberId: string;
}

const screenStyle: CSSProperties = {
  padding: '0 0 24px',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#CBD5E1',
  margin: '20px 0 10px',
};

const toggleBtnStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#94A3B8',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const toggleActiveStyle: CSSProperties = {
  ...toggleBtnStyle,
  background: 'rgba(239,159,39,0.15)',
  borderColor: 'rgba(239,159,39,0.3)',
  color: '#EF9F27',
};

const coachingStyle: CSSProperties = {
  borderRadius: 10,
  background: 'rgba(255,255,255,0.03)',
  padding: '12px 14px',
  marginTop: 16,
};

export function DNAProfileScreen({ memberId }: DNAProfileScreenProps) {
  const { data, isLoading, error } = useDNA(memberId);
  const [showComparison, setShowComparison] = useState(false);
  const [activeDimension, setActiveDimension] = useState<string | null>(null);

  if (isLoading) return <DNASkeleton />;

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#D85A30', fontSize: 13 }}>Failed to load Performance DNA.</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.is_building) {
    return (
      <div style={screenStyle}>
        <DNABuildingState
          sessionsLogged={data.sessions_logged}
          distinctMachines={data.distinct_machines}
        />
      </div>
    );
  }

  // Find lowest scoring dimension for coaching highlight
  const dimensions = DNA_AXES.map((a) => a.key);
  const lowestDim = dimensions.reduce((low, key) =>
    data.scores[key] < data.scores[low] ? key : low,
  );

  return (
    <div style={screenStyle}>
      <DNAArchetypeCard archetype={data.archetype} variant="full" />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        {data.previous_scores && (
          <button
            style={showComparison ? toggleActiveStyle : toggleBtnStyle}
            onClick={() => setShowComparison((prev) => !prev)}
          >
            {showComparison ? 'Hide previous' : 'Compare'}
          </button>
        )}
      </div>

      <DNARadarChart
        scores={data.scores}
        previousScores={data.previous_scores ?? undefined}
        size="full"
        showLabels
        showComparison={showComparison}
      />

      <h4 style={sectionTitleStyle}>Dimensions</h4>
      {dimensions.map((key) => (
        <DNADimensionRow
          key={key}
          dimensionKey={key}
          score={data.scores[key]}
          previousScore={data.previous_scores?.[key]}
          signals={data.signals[key as DNADimension] ?? null}
          isActive={activeDimension === key}
          onPress={() => setActiveDimension(activeDimension === key ? null : key)}
        />
      ))}

      <div style={coachingStyle}>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 4px' }}>Coaching Focus</p>
        <p style={{ fontSize: 13, color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
          {data.archetype.coaching_focus}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '8px 0 0', fontStyle: 'italic' }}>
          Lowest dimension:{' '}
          <span style={{ color: '#EF9F27', fontWeight: 600 }}>
            {DIMENSION_CONFIG[lowestDim as keyof typeof DIMENSION_CONFIG].label} ({Math.round(data.scores[lowestDim])})
          </span>
        </p>
      </div>

      <DNAHistoryChart snapshots={data.history} />
    </div>
  );
}
