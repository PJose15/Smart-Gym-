'use client';

import type { CSSProperties } from 'react';

interface DayExercise {
  exercise_name: string;
  machine_id?: string | null;
  default_sets: number;
  default_reps: number;
}

interface DayData {
  day_number: number;
  name: string;
  exercises: DayExercise[];
}

interface DayCardProps {
  day: DayData;
  isToday: boolean;
  dayIndex: number;
}

export function DayCard({ day, isToday, dayIndex }: DayCardProps) {
  return (
    <div style={{
      ...cardStyle,
      ...(isToday ? todayAccentStyle : {}),
    }}>
      <div style={headerStyle}>
        <span style={dayLabelStyle}>
          Day {dayIndex + 1} — {day.name}
        </span>
        {isToday && <span style={todayBadgeStyle}>Today</span>}
      </div>

      <div style={exerciseListStyle}>
        {day.exercises.map((ex, i) => (
          <div key={i} style={exerciseRowStyle}>
            <span style={exerciseNumStyle}>{i + 1}</span>
            <span style={exerciseNameStyle}>{ex.exercise_name}</span>
            <span style={exerciseDetailStyle}>
              {ex.default_sets} × {ex.default_reps}
            </span>
          </div>
        ))}
        {day.exercises.length === 0 && (
          <p style={emptyExStyle}>No exercises assigned</p>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-card-bg, #1e1e2e)',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  borderLeft: '3px solid transparent',
};

const todayAccentStyle: CSSProperties = {
  borderLeftColor: 'var(--color-blue, #3b82f6)',
  backgroundColor: 'var(--color-card-bg-elevated, #252538)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const dayLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

const todayBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 12,
  backgroundColor: 'var(--color-blue-surface, rgba(59,130,246,0.12))',
  color: 'var(--color-blue, #3b82f6)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const exerciseListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const exerciseRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
};

const exerciseNumStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: 'var(--color-border, rgba(255,255,255,0.08))',
  color: 'var(--color-text-tertiary, rgba(255,255,255,0.45))',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const exerciseNameStyle: CSSProperties = {
  flex: 1,
  color: 'var(--color-text-primary)',
};

const exerciseDetailStyle: CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const emptyExStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-tertiary, rgba(255,255,255,0.45))',
  margin: 0,
  fontStyle: 'italic',
};
