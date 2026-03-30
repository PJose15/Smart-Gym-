'use client';

import type { ProgramContextData, TodaySessionData } from '@nexera/types';
import { CSSProperties } from 'react';

interface TodayZoneProps {
  program: ProgramContextData | null;
  todaySessions: TodaySessionData[];
}

const cardStyle: CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius: 'var(--radius-md, 12px)',
  padding: 'var(--space-4, 16px)',
  animation: 'slideUpFade 0.4s ease-out 0.1s both',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#94A3B8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 12,
};

export function TodayZone({ program, todaySessions }: TodayZoneProps) {
  // Program mode
  if (program && !program.is_complete) {
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>Today&apos;s Program</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
          {program.program_name}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
          Week {program.week_number} of {program.total_weeks}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6,
          backgroundColor: '#334155',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 12,
        }}>
          <div style={{
            height: '100%',
            width: `${program.progress_pct}%`,
            backgroundColor: '#3B82F6',
            borderRadius: 3,
            transition: 'width 0.4s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#64748B' }}>
          {program.sessions_completed} / {program.sessions_total} sessions
        </div>

        {/* Today's exercises */}
        {program.today_exercises.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {program.today_exercises.map((ex, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: '#CBD5E1',
              }}>
                <span>{ex.name}</span>
                <span style={{ color: '#64748B' }}>{ex.sets}x{ex.reps}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Free mode — show today's sessions or prompt
  if (todaySessions.length > 0) {
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>Today&apos;s Sessions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todaySessions.map((s) => (
            <div key={s.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: '#CBD5E1',
            }}>
              <span>{s.machine_name}</span>
              <span style={{ color: '#64748B', fontSize: 12 }}>
                {s.sets_count} sets · {Math.round(s.total_volume_lbs).toLocaleString()} lbs
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No sessions yet
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Today</div>
      <div style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
        Scan a machine QR code to start your session.
      </div>
    </div>
  );
}
