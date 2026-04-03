'use client';

import type { CSSProperties } from 'react';

interface ProgramHeaderProps {
  title: string;
  description: string | null;
  goal: string | null;
  durationWeeks: number;
  sessionsPerWeek: number;
  weekNumber: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  onTrack: boolean;
  generatedBy: string;
  trainerApproved: boolean;
  trainerName: string | null;
}

export function ProgramHeader({
  title,
  description,
  goal,
  durationWeeks,
  sessionsPerWeek,
  weekNumber,
  sessionsCompleted,
  sessionsTotal,
  onTrack,
  generatedBy,
  trainerApproved,
  trainerName,
}: ProgramHeaderProps) {
  const progressPct = sessionsTotal > 0 ? Math.round((sessionsCompleted / sessionsTotal) * 100) : 0;

  return (
    <div style={cardStyle}>
      <h2 style={titleStyle}>{title}</h2>

      {description && (
        <p style={descStyle}>{description}</p>
      )}

      {/* Creator + approval badges */}
      <div style={badgeRowStyle} role="group" aria-label="Program source">
        <span style={badgeStyle} aria-label={generatedBy === 'ai' ? 'AI-Generated program' : `Program built by ${trainerName || 'Trainer'}`}>
          {generatedBy === 'ai' ? '🤖 AI-Generated' : `🏋️ Built by ${trainerName || 'Trainer'}`}
        </span>
        {trainerApproved && (
          <span style={{ ...badgeStyle, backgroundColor: 'var(--color-green-surface, rgba(34,197,94,0.12))', color: 'var(--color-green, #22c55e)' }} aria-label="Trainer approved">
            ✓ Trainer Approved
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div style={metaRowStyle}>
        <span>{durationWeeks}wk plan</span>
        <span style={metaDotStyle}>·</span>
        <span>{sessionsPerWeek}x/week</span>
        {goal && (
          <>
            <span style={metaDotStyle}>·</span>
            <span style={{ textTransform: 'capitalize' as const }}>{goal}</span>
          </>
        )}
      </div>

      {/* Week indicator + status */}
      <div style={weekRowStyle}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Week {weekNumber} of {durationWeeks}
        </span>
        <span
          aria-label={onTrack ? 'Program status: on track' : 'Program status: behind schedule'}
          style={{
            ...statusBadgeStyle,
            backgroundColor: onTrack
              ? 'var(--color-green-surface, rgba(34,197,94,0.12))'
              : 'var(--color-amber-surface, rgba(245,158,11,0.12))',
            color: onTrack
              ? 'var(--color-green, #22c55e)'
              : 'var(--color-amber, #f59e0b)',
          }}
        >
          {onTrack ? 'On Track' : 'Behind'}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={progressTrackStyle}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${progressPct}% complete — ${sessionsCompleted} of ${sessionsTotal} sessions`}
      >
        <div style={{ ...progressFillStyle, width: `${progressPct}%` }} />
      </div>
      <div style={progressLabelStyle}>
        <span>{sessionsCompleted} / {sessionsTotal} sessions</span>
        <span>{progressPct}%</span>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-card-bg, #1e1e2e)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const titleStyle: CSSProperties = {
  fontSize: 'var(--text-xl, 20px)',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
};

const descStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text-secondary)',
  margin: 0,
  lineHeight: 1.4,
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const badgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 20,
  backgroundColor: 'var(--color-blue-surface, rgba(59,130,246,0.12))',
  color: 'var(--color-blue, #3b82f6)',
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--color-text-secondary)',
};

const metaDotStyle: CSSProperties = { opacity: 0.5 };

const weekRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const statusBadgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 20,
};

const progressTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 3,
  backgroundColor: 'var(--color-border, rgba(255,255,255,0.08))',
  overflow: 'hidden',
};

const progressFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 3,
  backgroundColor: 'var(--color-blue, #3b82f6)',
  transition: 'width 0.3s ease',
};

const progressLabelStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--color-text-tertiary, rgba(255,255,255,0.45))',
};
