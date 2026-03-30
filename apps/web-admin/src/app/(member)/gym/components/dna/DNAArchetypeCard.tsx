'use client';

import { CSSProperties } from 'react';
import type { DNAArchetype } from '@nexera/types';

interface DNAArchetypeCardProps {
  archetype: DNAArchetype;
  variant?: 'full' | 'compact';
}

const fullCardStyle: CSSProperties = {
  borderRadius: 14,
  padding: 20,
  marginBottom: 16,
};

const compactCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 10,
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.05)',
};

export function DNAArchetypeCard({ archetype, variant = 'full' }: DNAArchetypeCardProps) {
  if (variant === 'compact') {
    return (
      <div style={compactCardStyle}>
        <div
          style={{
            width: 4,
            height: 28,
            borderRadius: 2,
            background: archetype.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 18 }}>{archetype.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>
          {archetype.name}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        ...fullCardStyle,
        background: `${archetype.color}1A`,
        border: `1px solid ${archetype.color}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 48 }}>{archetype.icon}</span>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
            {archetype.name}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: archetype.color,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Your Archetype
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.5 }}>
        {archetype.description}
      </p>
      <div
        style={{
          fontSize: 12,
          color: '#CBD5E1',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 8,
          padding: '8px 10px',
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontWeight: 700, color: archetype.color }}>Focus: </span>
        {archetype.coaching_focus}
      </div>
    </div>
  );
}
