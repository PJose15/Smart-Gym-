'use client';

import type { WeeklyStatsData } from '@nexera/types';
import { CSSProperties } from 'react';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { convertFromLbs, type WeightUnit } from '@/lib/weight';

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
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-sm, 8px)',
  padding: '10px 8px',
  textAlign: 'center',
  flex: 1,
  minWidth: 0,
};

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  const unit = useWeightUnit();

  const tiles: StatTile[] = [
    { label: 'Sessions/wk', value: String(stats.sessions_this_week), color: 'var(--accent-hover, #FF2740)' },
    { label: `${unit}/wk`, value: formatVolumeDisplay(stats.volume_this_week_lbs, unit), color: 'var(--color-green, #00C896)' },
    { label: 'PRs/mo', value: String(stats.prs_this_month), color: 'var(--gold, #E8B339)' },
    { label: 'All Sessions', value: String(stats.all_time_sessions), color: 'var(--color-text-primary)' },
    { label: `Total ${unit}`, value: formatVolumeDisplay(stats.all_time_volume_lbs, unit), color: 'var(--color-amber, #FF6B35)' },
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

/**
 * Stat-tile volume formatter. Returns a bare number (no unit suffix —
 * the tile label already carries the unit). Uses M/K suffixes for
 * readability at scale. Conversion happens before scale bucketing so
 * the threshold is evaluated in the display unit.
 */
function formatVolumeDisplay(lbs: number, unit: WeightUnit): string {
  const value = convertFromLbs(lbs, unit);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
