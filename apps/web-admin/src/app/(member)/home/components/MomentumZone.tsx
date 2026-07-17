'use client';

import type { LevelInfoData, WeeklyStatsData } from '@nexera/types';
import { CSSProperties } from 'react';
import { StreakFlame } from '@/components/gamification/StreakFlame';

interface MomentumZoneProps {
  streak: number;
  weekSessions: number;
  level: LevelInfoData;
  stats: WeeklyStatsData;
}

const tileStyle: CSSProperties = {
  flex: 1,
  backgroundColor: 'var(--color-bg-raised)',
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
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-streak, #FF6B35)' }}>
          {streak}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Week Streak
        </div>
        {/* Animated tier flame — streak is measured in weeks here */}
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
          <StreakFlame streakDays={streak * 7} size={16} />
        </div>
      </div>

      {/* Week dots tile */}
      <div style={tileStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>
          {weekSessions}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          This Week
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 6 }}>
          {dots.map((filled, i) => (
            <div key={i} style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: filled ? '#34D399' : 'var(--color-bg-elevated)',
            }} />
          ))}
        </div>
      </div>

      {/* Level tile */}
      <div style={tileStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, color: level.color }}>
          {level.level}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {level.name}
        </div>
        <div style={{
          height: 4,
          backgroundColor: 'var(--color-bg-elevated)',
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
