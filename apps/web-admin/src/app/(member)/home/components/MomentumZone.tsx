'use client';

import type { LevelInfoData, WeeklyStatsData } from '@nexera/types';
import { CSSProperties } from 'react';

interface MomentumZoneProps {
  streak: number;
  weekSessions: number;
  level: LevelInfoData;
  stats: WeeklyStatsData;
}

const tileStyle: CSSProperties = {
  flex: 1,
  backgroundColor: '#1E293B',
  borderRadius: 'var(--radius-md, 12px)',
  padding: '12px',
  textAlign: 'center',
  minWidth: 0,
};

export function MomentumZone({ streak, weekSessions, level }: MomentumZoneProps) {
  // Week dots (7 days, filled for sessions this week)
  const dots = Array.from({ length: 7 }, (_, i) => i < weekSessions);

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      animation: 'slideUpFade 0.4s ease-out 0.2s both',
    }}>
      {/* Streak tile */}
      <div style={tileStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#FBBF24' }}>
          {streak}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
          Week Streak
        </div>
        {/* Flame icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" style={{ marginTop: 4, opacity: streak > 0 ? 1 : 0.3 }}>
          <path d="M12 23c-4.97 0-9-3.58-9-8 0-5.5 9-13 9-13s9 7.5 9 13c0 4.42-4.03 8-9 8zm0-2c3.87 0 7-2.69 7-6 0-3.83-5.4-9.13-7-10.77C10.4 5.87 5 11.17 5 15c0 3.31 3.13 6 7 6z" />
        </svg>
      </div>

      {/* Week dots tile */}
      <div style={tileStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>
          {weekSessions}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
          This Week
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 6 }}>
          {dots.map((filled, i) => (
            <div key={i} style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: filled ? '#34D399' : '#334155',
            }} />
          ))}
        </div>
      </div>

      {/* Level tile */}
      <div style={tileStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, color: level.color }}>
          {level.level}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
          {level.name}
        </div>
        <div style={{
          height: 4,
          backgroundColor: '#334155',
          borderRadius: 2,
          overflow: 'hidden',
          marginTop: 6,
        }}>
          <div style={{
            height: '100%',
            width: `${level.progressPct}%`,
            backgroundColor: level.color,
            borderRadius: 2,
          }} />
        </div>
      </div>
    </div>
  );
}
