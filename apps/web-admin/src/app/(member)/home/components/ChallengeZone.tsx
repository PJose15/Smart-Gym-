'use client';

import type { ChallengeData } from '@nexera/types';
import { CSSProperties } from 'react';

interface ChallengeZoneProps {
  challenge: ChallengeData;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: 'var(--space-4, 16px)',
  border: '1px solid var(--color-border-subtle)',
  animation: 'slideUpFade 0.4s ease-out 0.3s both',
};

export function ChallengeZone({ challenge }: ChallengeZoneProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-hover, #FF2740)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Active Challenge
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {challenge.title}
          </div>
        </div>
        <div style={{
          backgroundColor: 'var(--accent, #E0142F)',
          borderRadius: 'var(--radius-full, 99px)',
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-on-accent, #FFFFFF)',
        }}>
          #{challenge.rank}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          height: '100%',
          width: `${challenge.progress_pct}%`,
          backgroundColor: 'var(--accent, #E0142F)',
          borderRadius: 3,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
        <span><span style={{ fontFamily: 'var(--font-mono)' }}>{challenge.total_participants}</span> participants</span>
        <span><span style={{ fontFamily: 'var(--font-mono)' }}>{challenge.days_left}</span> days left</span>
      </div>
    </div>
  );
}
