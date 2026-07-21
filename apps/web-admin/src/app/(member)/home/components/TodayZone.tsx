'use client';

import type { ProgramContextData, TodaySessionData } from '@nexera/types';
import { CSSProperties } from 'react';
import Link from 'next/link';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { convertFromLbs } from '@/lib/weight';

interface TodayZoneProps {
  program: ProgramContextData | null;
  todaySessions: TodaySessionData[];
}

/**
 * TodayZone — mirrors apps/mobile/src/components/home/TodayZone.tsx:
 * featured 22px L2 card, crimson "TODAY" kicker + day name, mono meta chip,
 * numbered exercise rows with hairline separators and right-aligned mono
 * set×rep, crimson CTA with sanctioned glow + secondary "View full program".
 */

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl, 22px)',
  padding: 'var(--space-4, 16px)',
  animation: 'slideUpFade 0.4s ease-out 0.1s both',
  overflow: 'hidden',
};

const kickerStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--accent, #E0142F)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const dayNameStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginTop: 4,
};

const metaChipStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

// Crimson CTA — sanctioned accent glow (design.md §3.11)
const ctaStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  backgroundColor: 'var(--accent, #E0142F)',
  borderRadius: 12,
  padding: '14px 0',
  textAlign: 'center',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-on-accent, #FFFFFF)',
  textDecoration: 'none',
  boxShadow: '0 4px 14px var(--accent-glow, rgba(224, 20, 47, 0.28))',
};

const secondaryLinkStyle: CSSProperties = {
  display: 'block',
  textAlign: 'center',
  padding: '10px 0 2px',
  marginTop: 8,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  textDecoration: 'none',
};

function ExerciseRow({ name, meta, position }: { name: string; meta: string; position: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderTop: position > 1 ? '1px solid var(--color-border-subtle)' : 'none',
    }}>
      {/* Numbered chip — mono */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {position}
        </span>
      </div>
      <span style={{
        flex: 1,
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
      {/* Right-aligned mono set×rep */}
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {meta}
      </span>
    </div>
  );
}

export function TodayZone({ program, todaySessions }: TodayZoneProps) {
  const unit = useWeightUnit();

  // Program mode — mirrors mobile "has program" card
  if (program && !program.is_complete) {
    return (
      <div style={cardStyle}>
        {/* Header: TODAY kicker + program name, mono meta chip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={kickerStyle}>Today</div>
            <div style={dayNameStyle}>{program.program_name}</div>
          </div>
          <div style={metaChipStyle}>
            {program.today_exercises.length > 0 && `${program.today_exercises.length} EX · `}
            WK {program.week_number}/{program.total_weeks}
          </div>
        </div>

        {/* Slim program progress bar + mono sessions count */}
        <div style={{
          height: 4,
          backgroundColor: 'var(--color-bg-elevated)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${program.progress_pct}%`,
            backgroundColor: 'var(--accent, #E0142F)',
            borderRadius: 2,
            transition: 'width 0.4s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {program.sessions_completed} / {program.sessions_total} sessions
        </div>

        {/* Numbered exercise rows — hairline separators, mono set×rep */}
        {program.today_exercises.length > 0 && (
          <div style={{ marginTop: 10, marginBottom: 16 }}>
            {program.today_exercises.map((ex, i) => (
              <ExerciseRow key={i} name={ex.name} meta={`${ex.sets}×${ex.reps}`} position={i + 1} />
            ))}
          </div>
        )}

        <Link href="/program" style={{ ...ctaStyle, marginTop: program.today_exercises.length > 0 ? 0 : 16 }}>
          Start today&apos;s workout →
        </Link>
        <Link href="/program" style={secondaryLinkStyle} aria-label="View full program">
          View full program →
        </Link>
      </div>
    );
  }

  // Free mode — show today's sessions (mirrors mobile "done" list treatment)
  if (todaySessions.length > 0) {
    return (
      <div style={cardStyle}>
        <div style={{ marginBottom: 4 }}>
          <div style={kickerStyle}>Today</div>
          <div style={dayNameStyle}>Today&apos;s Sessions</div>
        </div>
        <div>
          {todaySessions.map((s, i) => (
            <ExerciseRow
              key={s.id}
              name={s.machine_name}
              meta={`${s.sets_count} sets · ${Math.round(convertFromLbs(s.total_volume_lbs, unit)).toLocaleString()} ${unit}`}
              position={i + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // No sessions yet — freestyle prompt
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <div style={kickerStyle}>Today</div>
        <div style={dayNameStyle}>Freestyle session</div>
      </div>
      <p style={{
        margin: '0 0 16px',
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.4,
      }}>
        Scan a machine QR code to start your session. No plan needed.
      </p>
      <Link href="/program" style={ctaStyle}>
        View your program →
      </Link>
    </div>
  );
}
