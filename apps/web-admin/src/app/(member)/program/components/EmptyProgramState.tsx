'use client';

import type { CSSProperties } from 'react';

export function EmptyProgramState() {
  return (
    <div style={containerStyle}>
      <div style={iconStyle}>📋</div>
      <h2 style={headingStyle}>No Active Program</h2>
      <p style={subtitleStyle}>
        Your trainer will assign a program, or one will be generated based on your training history.
      </p>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '60px 24px',
  gap: 8,
};

const iconStyle: CSSProperties = {
  fontSize: 48,
  marginBottom: 8,
};

const headingStyle: CSSProperties = {
  fontSize: 'var(--text-lg, 18px)',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  color: 'var(--color-text-secondary)',
  margin: 0,
  maxWidth: 280,
  lineHeight: 1.5,
};
