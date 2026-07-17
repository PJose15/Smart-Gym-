'use client';

import { CSSProperties } from 'react';
import { DIMENSION_CONFIG, ARCHETYPES } from '@nexera/ai-assist';
import { useGymDNAStats } from '@/lib/hooks/useGymDNAStats';

interface GymDNAStatsProps {
  gymId: string;
}

const containerStyle: CSSProperties = { padding: '0 0 24px' };
const sectionTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--color-text-secondary)', margin: '0 0 12px' };
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 20 };
const tileStyle: CSSProperties = { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' };
const tileScoreStyle: CSSProperties = { fontSize: 22, fontWeight: 800, color: '#FFD700', margin: 0 };
const tileLabelStyle: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0 0' };
const archetypeRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const memberCountStyle: CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 16 };

type DimensionKey = keyof typeof DIMENSION_CONFIG;

export function GymDNAStats({ gymId }: GymDNAStatsProps) {
  const { data, isLoading, error } = useGymDNAStats(gymId);

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#FF4D6A', fontSize: 13 }}>{error || 'Unable to load gym DNA stats.'}</p>
      </div>
    );
  }

  const dimensionKeys = Object.keys(DIMENSION_CONFIG) as DimensionKey[];
  const distributionEntries = Object.entries(data.archetype_distribution).sort((a, b) => b[1] - a[1]);

  return (
    <div style={containerStyle}>
      <h4 style={sectionTitleStyle}>Gym Average Scores</h4>
      <div style={gridStyle}>
        {dimensionKeys.map((key) => {
          const config = DIMENSION_CONFIG[key];
          const avg = data.avg_scores[key] ?? 0;
          return (
            <div key={key} style={tileStyle}>
              <p style={tileScoreStyle}>{Math.round(avg)}</p>
              <p style={tileLabelStyle}>{config.icon} {config.label}</p>
            </div>
          );
        })}
      </div>

      <h4 style={sectionTitleStyle}>Archetype Distribution</h4>
      {distributionEntries.length > 0 ? (
        distributionEntries.map(([archetypeId, count]) => {
          const arch = ARCHETYPES[archetypeId];
          if (!arch) return null;
          return (
            <div key={archetypeId} style={archetypeRowStyle}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{arch.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1 }}>{arch.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: arch.color }}>{count}</span>
            </div>
          );
        })
      ) : (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No data yet.</p>
      )}

      <p style={memberCountStyle}>
        {data.member_count} member{data.member_count !== 1 ? 's' : ''} with DNA profiles
      </p>
    </div>
  );
}
