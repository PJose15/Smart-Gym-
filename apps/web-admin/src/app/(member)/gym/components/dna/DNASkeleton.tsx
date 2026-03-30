'use client';

import { CSSProperties } from 'react';

const pulseKeyframes = `
@keyframes dnaPulse {
  0%, 100% { opacity: 0.08; }
  50% { opacity: 0.14; }
}
`;

const blockBase: CSSProperties = {
  borderRadius: 12,
  background: 'rgba(255,255,255,0.08)',
  animation: 'dnaPulse 1.5s ease-in-out infinite',
};

export function DNASkeleton() {
  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Archetype card placeholder */}
        <div style={{ ...blockBase, height: 100 }} />
        {/* Pentagon area placeholder */}
        <div
          style={{
            ...blockBase,
            height: 200,
            animationDelay: '0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        {/* Dimension rows placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                ...blockBase,
                height: 42,
                animationDelay: `${0.3 + i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
