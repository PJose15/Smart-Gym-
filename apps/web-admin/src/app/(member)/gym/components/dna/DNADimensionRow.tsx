'use client';

import { CSSProperties, KeyboardEvent } from 'react';
import type { DNADimension } from '@nexera/types';
import { DIMENSION_CONFIG } from '@nexera/ai-assist';

interface DNADimensionRowProps {
  dimensionKey: DNADimension;
  score: number;
  previousScore?: number;
  signals: Record<string, number | string | null> | null;
  isActive: boolean;
  onPress: () => void;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#639922';
  if (score >= 50) return '#3B8BD4';
  if (score >= 25) return '#D85A30';
  return '#888780';
}

function formatSignalLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSignalValue(value: unknown): string {
  if (value == null) return '--';
  if (typeof value === 'number') return value % 1 === 0 ? String(value) : value.toFixed(1);
  return String(value);
}

const rowStyle: CSSProperties = {
  borderRadius: 10,
  background: 'rgba(255,255,255,0.03)',
  marginBottom: 6,
  overflow: 'hidden',
  transition: 'background 0.2s',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  cursor: 'pointer',
  userSelect: 'none',
};

const barTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: 3,
  background: 'rgba(255,255,255,0.06)',
  overflow: 'hidden',
};

const scoreStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  minWidth: 28,
  textAlign: 'right',
};

const expandedStyle: CSSProperties = {
  padding: '0 12px 12px',
  borderTop: '1px solid rgba(255,255,255,0.05)',
};

const signalRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontSize: 12,
};

const tipStyle: CSSProperties = {
  fontSize: 12,
  color: '#94A3B8',
  marginTop: 8,
  fontStyle: 'italic',
  lineHeight: 1.4,
};

export function DNADimensionRow({
  dimensionKey,
  score,
  previousScore,
  signals,
  isActive,
  onPress,
}: DNADimensionRowProps) {
  const config = DIMENSION_CONFIG[dimensionKey];
  if (!config) return null;

  const color = scoreColor(score);
  const diff = previousScore != null ? score - previousScore : null;
  const barWidth = `${Math.max(0, Math.min(100, score))}%`;

  return (
    <div style={{ ...rowStyle, background: isActive ? 'rgba(255,255,255,0.05)' : rowStyle.background }}>
      <div
        style={headerStyle}
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPress();
          }
        }}
      >
        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{config.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', width: 90 }}>
          {config.label}
        </span>
        <div style={barTrackStyle}>
          <div
            style={{
              height: '100%',
              width: barWidth,
              borderRadius: 3,
              background: color,
              transition: 'width 0.4s ease-out',
            }}
          />
        </div>
        <span style={{ ...scoreStyle, color }}>{Math.round(score)}</span>
        {diff != null && diff !== 0 && (
          <span style={{ fontSize: 11, color: diff > 0 ? '#639922' : '#D85A30', minWidth: 32 }}>
            {diff > 0 ? '\u25B2' : '\u25BC'} {Math.abs(diff)}
          </span>
        )}
      </div>

      {isActive && (
        <div style={expandedStyle}>
          {signals &&
            Object.entries(signals).map(([key, value]) => (
              <div key={key} style={signalRowStyle}>
                <span style={{ color: '#94A3B8' }}>{formatSignalLabel(key)}</span>
                <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{formatSignalValue(value)}</span>
              </div>
            ))}
          <p style={tipStyle}>{config.improvementTip(score)}</p>
        </div>
      )}
    </div>
  );
}
