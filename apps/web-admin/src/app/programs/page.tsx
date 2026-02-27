'use client';

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Program, ProgramDay, ProgramExercise } from '@smartgym/types';
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
          <Link href="/programs/create" style={createButtonStyle} className="btn-primary">
            + Create Program
          </Link>
        </div>

        {loading ? (
          <div style={centeredContainerStyle}>
            <div style={spinnerStyle} className="spinner-enhanced" />
            <p style={{ color: '#999', marginTop: 16, fontSize: 15 }}>
              Loading programs...
            </p>
          </div>
        ) : error ? (
          <div style={centeredContainerStyle}>
            <p style={{ color: '#e53935', fontSize: 15 }} className="error-shake">Error: {error}</p>
          </div>
        ) : programs.length === 0 ? (
          <div style={centeredContainerStyle}>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 16 }} className="empty-breathe">
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
                  {program.description && (
                    <p style={cardDescriptionStyle}>
                      {program.description.length > 120
                        ? program.description.slice(0, 120) + '...'
                        : program.description}
                    </p>
                  )}
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
  backgroundColor: '#4fc3f7',
  color: '#ffffff',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const centeredContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 8,
  padding: 40,
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #e0e0e0',
  borderTopColor: '#4fc3f7',
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
  backgroundColor: '#ffffff',
  borderRadius: 8,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  cursor: 'pointer',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  margin: 0,
  color: '#1a1a2e',
};

const cardDescriptionStyle: CSSProperties = {
  fontSize: 14,
  color: '#666',
  margin: 0,
  lineHeight: 1.5,
};

const cardFooterStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 'auto',
  paddingTop: 12,
  borderTop: '1px solid #f0f0f0',
};

const cardBadgeStyle: CSSProperties = {
  fontSize: 13,
  color: '#888',
  fontWeight: 500,
};
