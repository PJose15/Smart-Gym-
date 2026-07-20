'use client';

import { CSSProperties } from 'react';
import type { DNAScores, DNAArchetype } from '@nexera/types';
import { DNA_AXES, DIMENSION_CONFIG } from '@nexera/ai-assist';
import { DNARadarChart } from './DNARadarChart';

interface TrainerDNACardProps {
  scores: DNAScores;
  archetype: DNAArchetype;
  isBuilding: boolean;
}

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-raised)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 12,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 12,
};

const lowestStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--color-red, #FF4D6A)',
  marginTop: 10,
  padding: '6px 10px',
  borderRadius: 6,
  background: 'var(--color-red-subtle, rgba(255, 77, 106, 0.10))',
};

export function TrainerDNACard({ scores, archetype, isBuilding }: TrainerDNACardProps) {
  if (isBuilding) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 20 }}>{'\uD83E\uDDEC'}</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>DNA forming...</span>
        </div>
      </div>
    );
  }

  // Find lowest dimension
  const allKeys = DNA_AXES.map((a) => a.key);
  const lowestKey = allKeys.reduce((low, key) =>
    scores[key] < scores[low] ? key : low,
  );
  const lowestConfig = DIMENSION_CONFIG[lowestKey as keyof typeof DIMENSION_CONFIG];

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 22 }}>{archetype.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {archetype.name}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {archetype.coaching_focus}
          </p>
        </div>
      </div>

      <DNARadarChart scores={scores} size="compact" showLabels={false} />

      <div style={lowestStyle}>
        <span style={{ fontWeight: 700 }}>{lowestConfig.icon} {lowestConfig.label}</span>
        {' '}is the lowest at{' '}
        <span style={{ fontWeight: 700 }}>{Math.round(scores[lowestKey])}</span>
      </div>
    </div>
  );
}
