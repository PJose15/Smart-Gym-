'use client';

import { useEffect } from 'react';
import { CSSProperties } from 'react';

interface AchievementNotificationProps {
  title: string;
  points: number;
  onDismiss: () => void;
  delay?: number;
}

const toastStyle: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: 360,
  width: 'calc(100% - 32px)',
  backgroundColor: '#1E293B',
  borderRadius: 'var(--radius-md, 12px)',
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  border: '1px solid #334155',
  zIndex: 100,
  animation: 'slideUpFade 0.3s ease-out both',
};

export function AchievementNotification({ title, points, onDismiss, delay = 3000 }: AchievementNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, delay);
    return () => clearTimeout(timer);
  }, [onDismiss, delay]);

  return (
    <div style={toastStyle} role="alert" aria-live="polite">
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        backgroundColor: '#FBBF24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>
        &#127942;
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
          +{points} points
        </div>
      </div>
    </div>
  );
}
