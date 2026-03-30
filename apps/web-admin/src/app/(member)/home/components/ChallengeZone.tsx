'use client';

import type { ChallengeData } from '@nexera/types';
import { CSSProperties } from 'react';

interface ChallengeZoneProps {
  challenge: ChallengeData;
}

const cardStyle: CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius: 'var(--radius-md, 12px)',
  padding: 'var(--space-4, 16px)',
  border: '1px solid #334155',
  animation: 'slideUpFade 0.4s ease-out 0.3s both',
};

export function ChallengeZone({ challenge }: ChallengeZoneProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Active Challenge
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
            {challenge.title}
          </div>
        </div>
        <div style={{
          backgroundColor: '#7C3AED',
          borderRadius: 'var(--radius-full, 99px)',
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
        }}>
          #{challenge.rank}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          height: '100%',
          width: `${challenge.progress_pct}%`,
          backgroundColor: '#A78BFA',
          borderRadius: 3,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
        <span>{challenge.total_participants} participants</span>
        <span>{challenge.days_left} days left</span>
      </div>
    </div>
  );
}
