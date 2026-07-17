'use client';

import { CSSProperties } from 'react';

interface DNABuildingStateProps {
  sessionsLogged: number;
  distinctMachines?: number;
}

const containerStyle: CSSProperties = {
  borderRadius: 14,
  background: 'rgba(255,255,255,0.03)',
  padding: 24,
  textAlign: 'center',
};

const headingStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 8px',
};

const descStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  margin: '0 0 20px',
  lineHeight: 1.5,
};

const trackStyle: CSSProperties = {
  height: 8,
  borderRadius: 4,
  background: 'rgba(255,255,255,0.06)',
  overflow: 'hidden',
  marginBottom: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
};

export function DNABuildingState({ sessionsLogged, distinctMachines }: DNABuildingStateProps) {
  const sessionProgress = Math.min(1, sessionsLogged / 10);
  const machineProgress = distinctMachines != null ? Math.min(1, distinctMachines / 3) : sessionProgress;
  const progress = Math.min(100, Math.round((sessionProgress * 0.7 + machineProgress * 0.3) * 100));

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83E\uDDEC'}</div>
      <h2 style={headingStyle}>Your DNA is forming</h2>
      <p style={descStyle}>
        Log at least 10 sessions on 3 or more machines to unlock your full Performance DNA profile.
        {distinctMachines != null && distinctMachines < 3 && (
          <> You have used {distinctMachines} machine{distinctMachines !== 1 ? 's' : ''} so far.</>
        )}
      </p>
      <div style={trackStyle}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: 4,
            background: 'linear-gradient(90deg, #FFD700, #FFB020)',
            transition: 'width 0.4s ease-out',
          }}
        />
      </div>
      <span style={labelStyle}>
        {sessionsLogged} of 10 sessions logged
      </span>
    </div>
  );
}
