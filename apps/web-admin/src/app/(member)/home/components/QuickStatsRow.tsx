'use client';

import type { WeeklyStatsData } from '@nexera/types';
import { CSSProperties } from 'react';

interface QuickStatsRowProps {
  stats: WeeklyStatsData;
}

interface StatTile {
  label: string;
  value: string;
  color: string;
}

const tileStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '10px 8px',
  textAlign: 'center',
  flex: 1,
  minWidth: 0,
};

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  const tiles: StatTile[] = [
    { label: 'Sessions/wk', value: String(stats.sessions_this_week), color: '#3B82F6' },
    { label: 'lbs/wk', value: formatVolume(stats.volume_this_week_lbs), color: '#10B981' },
    { label: 'PRs/mo', value: String(stats.prs_this_month), color: '#FBBF24' },
    { label: 'All Sessions', value: String(stats.all_time_sessions), color: '#A78BFA' },
    { label: 'Total lbs', value: formatVolume(stats.all_time_volume_lbs), color: '#F97316' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      animation: 'slideUpFade 0.4s ease-out 0.25s both',
    }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={tileStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: tile.color, fontFamily: 'var(--font-mono)' }}>
            {tile.value}
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tile.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000000) return `${(lbs / 1000000).toFixed(1)}M`;
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}K`;
  return String(Math.round(lbs));
}
