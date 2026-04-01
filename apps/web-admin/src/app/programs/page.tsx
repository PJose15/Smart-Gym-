'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Program, ProgramDay, ProgramExercise } from '@nexera/types';
import { PageHeader } from '../components/PageHeader';
import { AnimatedPage } from '../components/AnimatedPage';

type ProgramWithDays = Program & {
  program_days: (Pick<ProgramDay, 'id' | 'day_number' | 'name'> & {
    program_exercises: Pick<ProgramExercise, 'id'>[];
  })[];
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrograms() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('programs')
        .select(
          '*, program_days(id, day_number, name, program_exercises(id))'
        )
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPrograms((data as ProgramWithDays[]) ?? []);
      }
      setLoading(false);
    }
    fetchPrograms();
  }, []);

  const totalExercises = (program: ProgramWithDays): number =>
    program.program_days.reduce(
      (sum, day) => sum + (day.program_exercises?.length ?? 0),
      0
    );

  return (
    <AnimatedPage>
      <div style={{ padding: '24px' }}>
        <div style={headerStyle}>
          <PageHeader
            title="Programs"
            description="Create and manage workout programs, assign exercises, and set training schedules."
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/programs/generate" style={{ ...createButtonStyle, backgroundColor: 'var(--color-blue-dark)' }} className="btn-primary">
              Generate with AI
            </Link>
            <Link href="/programs/create" style={createButtonStyle} className="btn-primary">
              + Create Program
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && !error && programs.length > 0 && (() => {
          const totalDays = programs.reduce((s, p) => s + p.program_days.length, 0);
          const totalEx = programs.reduce((s, p) => s + totalExercises(p), 0);
          const avgDays = programs.length > 0 ? Math.round(totalDays / programs.length * 10) / 10 : 0;
          return (
            <div style={statsStripStyle}>
              <span style={statsChipStyle}>{programs.length} program{programs.length !== 1 ? 's' : ''}</span>
              <span style={statsChipStyle}>{totalDays} total days</span>
              <span style={statsChipStyle}>{totalEx} total exercises</span>
              <span style={statsChipStyle}>{avgDays} avg days/program</span>
            </div>
          );
        })()}

        {loading ? (
          <div style={centeredContainerStyle}>
            <div style={spinnerStyle} className="spinner-enhanced" />
            <p style={{ color: 'var(--color-text-muted)', marginTop: 16, fontSize: 'var(--text-base)' as unknown as number }}>
              Loading programs...
            </p>
          </div>
        ) : error ? (
          <div style={centeredContainerStyle}>
            <p style={{ color: 'var(--color-red-light)', fontSize: 'var(--text-base)' as unknown as number }} className="error-shake">Error: {error}</p>
          </div>
        ) : programs.length === 0 ? (
          <div style={centeredContainerStyle}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' as unknown as number, marginBottom: 16 }} className="empty-breathe">
              No programs yet. Create your first workout program to get started.
            </p>
            <Link href="/programs/create" style={createButtonStyle} className="btn-primary">
              + Create Program
            </Link>
          </div>
        ) : (
          <div style={gridStyle}>
            {programs.map((program, i) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                style={cardLinkStyle}
              >
                <div style={cardStyle} className={`card-stagger stagger-${Math.min(i, 19)} card-hover-lift`}>
                  <h3 style={cardTitleStyle}>{program.name}</h3>
                  {program.description ? (
                    <p style={cardDescriptionStyle}>
                      {program.description.length > 120
                        ? program.description.slice(0, 120) + '...'
                        : program.description}
                    </p>
                  ) : null}
                  <div style={cardFooterStyle}>
                    <span style={cardBadgeStyle}>
                      {program.program_days.length}{' '}
                      {program.program_days.length === 1 ? 'day' : 'days'}
                    </span>
                    <span style={cardBadgeStyle}>
                      {totalExercises(program)}{' '}
                      {totalExercises(program) === 1 ? 'exercise' : 'exercises'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 32,
  flexWrap: 'wrap',
  gap: 16,
};

const createButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 20px',
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
  borderRadius: 'var(--radius-sm)' as unknown as number,
  textDecoration: 'none',
  fontSize: 'var(--text-base)' as unknown as number,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const centeredContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 40,
  textAlign: 'center',
  border: '1px solid var(--color-border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid var(--color-border-default)',
  borderTopColor: 'var(--color-blue)',
  borderRadius: '50%',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 20,
};

const cardLinkStyle: CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  cursor: 'pointer',
  border: '1px solid var(--color-border-subtle)',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  margin: 0,
  color: 'var(--color-text-primary)',
};

const cardDescriptionStyle: CSSProperties = {
  fontSize: 'var(--text-base)' as unknown as number,
  color: 'var(--color-text-secondary)',
  margin: 0,
  lineHeight: 1.5,
};

const cardFooterStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 'auto',
  paddingTop: 12,
  borderTop: '1px solid var(--color-border-subtle)',
};

const cardBadgeStyle: CSSProperties = {
  fontSize: 'var(--text-sm)' as unknown as number,
  color: 'var(--color-text-muted)',
  fontWeight: 500,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 'var(--text-xs)' as unknown as number,
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};
