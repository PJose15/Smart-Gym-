'use client';

import { useEffect, useRef, useState, CSSProperties } from 'react';
import { useLiveGymActivity, LiveActivityEvent } from '@/hooks/useLiveGymActivity';

const stripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#1E293B',
  borderRadius: 10,
  padding: '12px 16px',
  border: '1px solid #334155',
  gap: 16,
  height: 56,
  overflow: 'hidden',
};

const leftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  backgroundColor: '#22C55E',
  borderRadius: '50%',
  boxShadow: '0 0 5px #22C55E',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#22C55E',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const centerStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  height: 24,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
};

const eventTextStyle: CSSProperties = {
  fontSize: 13,
  color: '#94A3B8',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const rightStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  flexShrink: 0,
};

const countStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#F1F5F9',
  lineHeight: 1,
};

const countLabelStyle: CSSProperties = {
  fontSize: 9,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function LiveActivityStrip() {
  const { events, liveCount } = useLiveGymActivity();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const prevFirstIdRef = useRef<string | null>(null);

  // Auto-cycle through events every 4 seconds
  useEffect(() => {
    if (events.length === 0) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % Math.min(events.length, 10));
      setAnimKey((k) => k + 1);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, [events.length]);

  // Reset index when newest event changes (track by ID, not length)
  useEffect(() => {
    const firstId = events[0]?.id ?? null;
    if (firstId && firstId !== prevFirstIdRef.current) {
      setCurrentIndex(0);
      setAnimKey((k) => k + 1);
    }
    prevFirstIdRef.current = firstId;
  }, [events]);

  const currentEvent: LiveActivityEvent | undefined = events[currentIndex];

  return (
    <div style={stripStyle} role="status" aria-live="polite" aria-label="Live gym activity">
      {/* Left: live indicator */}
      <div style={leftStyle}>
        <div style={dotStyle} className="live-indicator-dot" />
        <span style={labelStyle}>Live</span>
      </div>

      {/* Center: cycling event text */}
      <div style={centerStyle}>
        {currentEvent ? (
          <div key={animKey} className="ticker-event-enter" style={eventTextStyle}>
            {currentEvent.text}
          </div>
        ) : (
          <div style={{ ...eventTextStyle, color: '#475569' }}>
            Waiting for activity...
          </div>
        )}
      </div>

      {/* Right: training-now count */}
      {liveCount > 0 && (
        <div style={rightStyle}>
          <span style={countStyle}>{liveCount}</span>
          <span style={countLabelStyle}>training now</span>
        </div>
      )}
    </div>
  );
}
