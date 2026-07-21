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

/**
 * MomentumZone — mirrors apps/mobile/src/components/home/MomentumZone.tsx:
 * uppercase MOMENTUM section label + three L2 stat tiles (22px radius,
 * hairline borders, mono hero numbers, tiny uppercase labels).
 */

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 12,
};

const tileStyle: CSSProperties = {
  flex: 1,
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl, 22px)',
  padding: 12,
  textAlign: 'center',
  minWidth: 0,
};

// Numbers are heroes — mono, big
const tileValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '-0.02em',
};

const tileLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 2,
};

export function MomentumZone({ streak, weekSessions, level }: MomentumZoneProps) {
  // Week dots (7 days, filled for sessions this week)
  const dots = Array.from({ length: 7 }, (_, i) => i < weekSessions);

  return (
    <div style={{ animation: 'slideUpFade 0.4s ease-out 0.2s both' }}>
      <div style={sectionLabelStyle}>Momentum</div>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* Streak tile */}
        <div style={tileStyle}>
          {/* Animated tier flame — streak is measured in weeks here */}
          <div style={{ display: 'flex', justifyContent: 'center', height: 22, alignItems: 'center', marginBottom: 4 }}>
            <StreakFlame streakDays={streak * 7} size={16} />
          </div>
          <div style={{ ...tileValueStyle, color: 'var(--color-streak, #FF6B35)' }}>
            {streak}
          </div>
          <div style={tileLabelStyle}>Week Streak</div>
        </div>

        {/* Week dots tile */}
        <div style={tileStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, height: 22, alignItems: 'center', marginBottom: 4 }}>
            {dots.map((filled, i) => (
              <div key={i} style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: filled ? 'var(--color-green, #00C896)' : 'var(--color-bg-elevated)',
              }} />
            ))}
          </div>
          <div style={{ ...tileValueStyle, color: 'var(--color-green, #00C896)' }}>
            {weekSessions}
          </div>
          <div style={tileLabelStyle}>This Week</div>
        </div>

        {/* Level tile */}
        <div style={tileStyle}>
          <div style={{
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}>
            <div style={{
              height: 4,
              width: 48,
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${level.progressPct}%`,
                backgroundColor: level.color,
                borderRadius: 2,
              }} />
            </div>
          </div>
          <div style={{ ...tileValueStyle, color: level.color }}>
            {level.level}
          </div>
          <div style={tileLabelStyle}>{level.name}</div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
            marginTop: 2,
          }}>
            {level.score.toLocaleString()} pts
          </div>
        </div>
      </div>
    </div>
  );
}
