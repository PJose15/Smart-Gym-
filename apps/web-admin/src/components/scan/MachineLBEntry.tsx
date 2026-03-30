'use client';

import { CSSProperties } from 'react';
import type { MachineLeaderboardEntry } from '@nexera/types';

interface MachineLBEntryProps {
  entry: MachineLeaderboardEntry;
}

const RANK_COLORS: Record<number, string> = {
  1: '#EF9F27',  // Gold
  2: '#B4B2A9',  // Silver
  3: '#D85A30',  // Bronze
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
};

const currentMemberStyle: CSSProperties = {
  ...rowStyle,
  backgroundColor: 'rgba(59, 130, 246, 0.08)',
  borderRadius: 8,
  padding: '8px 10px',
  margin: '0 -10px',
};

export function MachineLBEntry({ entry }: MachineLBEntryProps) {
  const rankColor = RANK_COLORS[entry.rank] ?? '#94A3B8';

  return (
    <div style={entry.is_current_member ? currentMemberStyle : rowStyle}>
      {/* Rank */}
      <div style={{
        width: 24,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 700,
        color: rankColor,
        flexShrink: 0,
      }}>
        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
      </div>

      {/* Avatar */}
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt=""
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: '#334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: '#94A3B8',
          flexShrink: 0,
        }}>
          {entry.display_name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name */}
      <div style={{
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        fontWeight: entry.is_current_member ? 600 : 400,
        color: entry.is_current_member ? '#F1F5F9' : '#E2E8F0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {entry.display_name}
        {entry.is_current_member && (
          <span style={{ fontSize: 10, color: '#60A5FA', marginLeft: 6 }}>You</span>
        )}
      </div>

      {/* Weight */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: rankColor,
        flexShrink: 0,
      }}>
        {entry.best_weight_lbs} lbs
      </div>
    </div>
  );
}
