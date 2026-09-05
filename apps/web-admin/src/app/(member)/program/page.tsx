'use client';

import { useState, useEffect } from 'react';
import { extractAiProgramDays } from '@nexera/utils';
import { useMember } from '@/lib/contexts/MemberContext';
import { SkeletonGate } from '@/components/skeleton';
import { ProgramPageSkeleton } from './components/ProgramPageSkeleton';
import { ProgramHeader } from './components/ProgramHeader';
import { DayCard } from './components/DayCard';
import { EmptyProgramState } from './components/EmptyProgramState';

interface ProgramExercise {
  exercise_name: string;
  machine_id?: string | null;
  default_sets: number;
  default_reps: number;
}

interface ProgramDay {
  day_number: number;
  name: string;
  exercises: ProgramExercise[];
}

interface ProgramData {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  duration_weeks: number;
  sessions_per_week: number;
  week_number: number;
  day_number: number;
  sessions_completed: number;
  sessions_total: number;
  on_track: boolean;
  /** Raw ai_programs.program_data JSON — `{ days }` or `{ weeks: [{ days }] }`. */
  program_data: unknown;
  generated_by: string;
  trainer_approved: boolean;
  trainer_name: string | null;
  created_at: string;
}

export default function ProgramPage() {
  const { member } = useMember();
  const [program, setProgram] = useState<ProgramData | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!member) return;

    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/member/${member.id}/program`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        if (!cancelled) setProgram(json.program);
      } catch {
        if (!cancelled) setError('Something went wrong. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [member, retryCount]);

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          style={{
            backgroundColor: 'var(--color-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <SkeletonGate loading={loading} skeleton={<ProgramPageSkeleton />}>
      {program === null && <EmptyProgramState />}

      {program && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          <ProgramHeader
            title={program.title}
            description={program.description}
            goal={program.goal}
            durationWeeks={program.duration_weeks}
            sessionsPerWeek={program.sessions_per_week}
            weekNumber={program.week_number}
            sessionsCompleted={program.sessions_completed}
            sessionsTotal={program.sessions_total}
            onTrack={program.on_track}
            generatedBy={program.generated_by}
            trainerApproved={program.trainer_approved}
            trainerName={program.trainer_name}
          />

          {(() => {
            // Handles both { days } and { weeks: [{ days }] } shaped rows.
            const days = extractAiProgramDays<ProgramDay>(program.program_data);
            const todayIdx = program.sessions_per_week > 0
              ? ((program.day_number - 1) % program.sessions_per_week + program.sessions_per_week) % program.sessions_per_week
              : -1;
            return days.map((day, idx) => (
              <DayCard
                key={day.day_number}
                day={day}
                isToday={idx === todayIdx}
                dayIndex={idx}
              />
            ));
          })()}
        </div>
      )}
    </SkeletonGate>
  );
}
