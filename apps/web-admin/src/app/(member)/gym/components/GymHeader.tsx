'use client';

import { CSSProperties } from 'react';

interface GymHeaderProps {
  gymName: string;
  logoUrl: string | null;
  memberCount?: number;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 20,
  animation: 'slideUpFade 0.3s ease-out both',
};

const avatarStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 22,
  fontWeight: 700,
  color: '#fff',
  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  flexShrink: 0,
};

export function GymHeader({ gymName, logoUrl, memberCount }: GymHeaderProps) {
  return (
    <div style={containerStyle}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={gymName}
          style={{ ...avatarStyle, objectFit: 'cover' }}
        />
      ) : (
        <div style={avatarStyle}>
          {gymName.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {gymName}
        </h1>
        {memberCount != null && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
