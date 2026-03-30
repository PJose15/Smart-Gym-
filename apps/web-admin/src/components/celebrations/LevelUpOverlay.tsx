'use client';

import { useEffect } from 'react';
import { CSSProperties } from 'react';

interface LevelUpOverlayProps {
  level: number;
  name: string;
  color: string;
  onDismiss: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.85)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  animation: 'fadeIn 0.3s ease-out both',
};

export function LevelUpOverlay({ level, name, color, onDismiss }: LevelUpOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={overlayStyle} onClick={onDismiss} role="dialog" aria-label="Level up celebration">
      <div style={{ animation: 'scaleIn 0.4s ease-out both', textAlign: 'center' }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 8,
        }}>
          Level Up
        </div>
        <div style={{
          fontSize: 72,
          fontWeight: 900,
          color,
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
        }}>
          {level}
        </div>
        <div style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#F1F5F9',
          marginTop: 8,
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 14,
          color: '#64748B',
          marginTop: 16,
        }}>
          Tap to continue
        </div>
      </div>
    </div>
  );
}
