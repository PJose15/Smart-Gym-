'use client';

import { useEffect, useState } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { SkeletonGate } from '@/components/skeleton';

interface WeeklyVolume {
  week: string;
  volume: number;
}

interface PersonalRecord {
  machine_name: string;
  weight_lbs: number;
  reps: number;
  date: string;
  est_1rm: number;
}

interface RecentWorkout {
  id: string;
  date: string;
  machine_name: string | null;
  volume_lbs: number;
  sets: number;
  duration_min: number;
}

interface ProgressData {
  stats: {
    total_workouts: number;
    total_volume_lbs: number;
    total_sets: number;
    avg_per_week: number;
    current_streak: number;
  };
  weekly_volume: WeeklyVolume[];
  workout_dates: string[];
  personal_records: PersonalRecord[];
  recent_workouts: RecentWorkout[];
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface, #141420)',
  borderRadius: 12,
  padding: 16,
  border: '1px solid var(--color-border, #2a2a3e)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 12px',
};

function ProgressSkeleton() {
  return (
    <div style={{ padding: 16, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ height: 22, width: 120, borderRadius: 6, backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 12, backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
        ))}
      </div>
      <div style={{ height: 140, borderRadius: 12, backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
      <div style={{ height: 100, borderRadius: 12, backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
    </div>
  );
}

function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K`;
  return String(lbs);
}

/** Simple bar chart for weekly volume */
function VolumeChart({ data }: { data: WeeklyVolume[] }) {
  const maxVol = Math.max(...data.map((d) => d.volume), 1);

  return (
    <div style={cardStyle}>
      <p style={sectionTitle}>Weekly Volume</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
        {data.map((d, i) => {
          const pct = (d.volume / maxVol) * 100;
          const isLast = i === data.length - 1;
          return (
            <div key={d.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: '100%',
                  minHeight: 4,
                  height: `${pct}%`,
                  borderRadius: 4,
                  backgroundColor: isLast ? 'var(--color-blue, #60A5FA)' : 'var(--color-surface-secondary, #2a2a3e)',
                  transition: 'height 0.3s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {data.map((d) => (
          <div key={d.week} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{d.week}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 30-day dot calendar */
function WorkoutCalendar({ dates }: { dates: string[] }) {
  const dateSet = new Set(dates);
  const days: { date: string; active: boolean; label: string }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().slice(0, 10);
    days.push({
      date: str,
      active: dateSet.has(str),
      label: String(d.getDate()),
    });
  }

  return (
    <div style={cardStyle}>
      <p style={sectionTitle}>Last 30 Days</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {days.map((d) => (
          <div
            key={d.date}
            title={d.date}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: d.active ? 700 : 400,
              color: d.active ? '#fff' : 'var(--color-text-muted)',
              backgroundColor: d.active ? 'var(--color-blue, #60A5FA)' : 'var(--color-surface-secondary, #1e1e2e)',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { member, loading: memberLoading } = useMember();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/member/${member.id}/progress`);
        if (!res.ok) throw new Error('Failed to load');
        setData(await res.json());
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [member?.id, retryCount]);

  if (memberLoading) return <ProgressSkeleton />;

  if (!member) {
    return (
      <div style={{ padding: 16, paddingTop: 24 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Not signed in.</p>
      </div>
    );
  }

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
    <SkeletonGate loading={loading} skeleton={<ProgressSkeleton />}>
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, paddingTop: 24 }}>
          <h1 style={{ fontSize: 'var(--text-xl, 20px)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Progress
          </h1>

          {/* Stats overview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Workouts', value: String(data.stats.total_workouts) },
              { label: 'Volume', value: `${formatVolume(data.stats.total_volume_lbs)} lbs` },
              { label: 'Avg / Week', value: String(data.stats.avg_per_week) },
              { label: 'Streak', value: `${data.stats.current_streak}d` },
            ].map((s) => (
              <div key={s.label} style={cardStyle}>
                <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Volume trend */}
          {data.weekly_volume.length > 0 && <VolumeChart data={data.weekly_volume} />}

          {/* Calendar */}
          <WorkoutCalendar dates={data.workout_dates} />

          {/* Personal records */}
          {data.personal_records.length > 0 && (
            <div>
              <p style={sectionTitle}>Personal Records</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.personal_records.map((pr) => (
                  <div
                    key={`${pr.machine_name}-${pr.date}`}
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {pr.machine_name}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {pr.weight_lbs} lbs x {pr.reps}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-orange, #F97316)' }}>
                        {pr.est_1rm}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: 0 }}>Est. 1RM</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent workouts */}
          {data.recent_workouts.length > 0 && (
            <div>
              <p style={sectionTitle}>Recent Workouts</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recent_workouts.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {w.machine_name && (
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                          {w.machine_name}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {w.sets} sets
                      </span>
                      {w.duration_min > 0 && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {w.duration_min}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 24 }} />
        </div>
      )}
    </SkeletonGate>
  );
}
