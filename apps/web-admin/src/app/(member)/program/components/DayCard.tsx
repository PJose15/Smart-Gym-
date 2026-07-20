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
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  borderLeft: '3px solid transparent',
};

const todayAccentStyle: CSSProperties = {
  borderLeftColor: 'var(--accent, #E0142F)',
  backgroundColor: 'var(--color-bg-elevated)',
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
  backgroundColor: 'var(--accent-subtle, rgba(224,20,47,0.10))',
  color: 'var(--accent-hover, #FF2740)',
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
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-muted)',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
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
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const emptyExStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-muted)',
  margin: 0,
  fontStyle: 'italic',
};
