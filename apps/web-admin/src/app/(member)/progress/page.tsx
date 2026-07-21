'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMember } from '@/lib/contexts/MemberContext';
import { formatVolume, formatWeight } from '@/lib/weight';
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

// Period filter — mirrors mobile progress screen's All/30d/60d/90d pills
type PeriodDays = 0 | 30 | 60 | 90;
const PERIOD_OPTIONS: Array<{ label: string; value: PeriodDays }> = [
  { label: 'All', value: 0 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: 16,
  border: '1px solid var(--color-border-subtle)',
};

// Uppercase section kicker — mirrors mobile sectionTitle
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  margin: '0 0 12px',
};

function ProgressSkeleton() {
  return (
    <div style={{ padding: 16, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ height: 22, width: 120, borderRadius: 6, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 12, backgroundColor: 'var(--color-bg-elevated)' }} />
        ))}
      </div>
      <div style={{ height: 140, borderRadius: 12, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 100, borderRadius: 12, backgroundColor: 'var(--color-bg-elevated)' }} />
    </div>
  );
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
                  backgroundColor: isLast ? 'var(--accent, #E0142F)' : 'var(--color-bg-elevated)',
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
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{d.week}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 30-day dot calendar (period-independent, like mobile's 4-week grid) */
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
              fontFamily: 'var(--font-mono)',
              color: d.active ? 'var(--text-on-accent, #FFFFFF)' : 'var(--color-text-muted)',
              backgroundColor: d.active ? 'var(--accent, #E0142F)' : 'var(--color-bg-elevated)',
              boxShadow: d.active ? '0 0 6px var(--accent-glow, rgba(224, 20, 47, 0.28))' : 'none',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Rank medal colors — mirrors mobile PR showcase (gold / silver / bronze)
const MEDAL_COLORS = ['var(--gold, #E8B339)', '#C0C0C0', '#CD7F32'];

export default function ProgressPage() {
  const { member, weightUnit, loading: memberLoading } = useMember();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [period, setPeriod] = useState<PeriodDays>(0);

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

  // Client-side period filtering (the API returns all-time data)
  const cutoff = useMemo(() => {
    if (period === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const filteredWeeklyVolume = useMemo(() => {
    if (!data) return [];
    if (period === 0) return data.weekly_volume;
    // Weekly buckets don't carry dates — slice the trailing weeks instead
    const weeks = Math.min(data.weekly_volume.length, Math.ceil(period / 7) + 1);
    return data.weekly_volume.slice(-weeks);
  }, [data, period]);

  const filteredPRs = useMemo(() => {
    if (!data) return [];
    if (!cutoff) return data.personal_records;
    return data.personal_records.filter((pr) => pr.date >= cutoff);
  }, [data, cutoff]);

  const filteredWorkouts = useMemo(() => {
    if (!data) return [];
    if (!cutoff) return data.recent_workouts;
    return data.recent_workouts.filter((w) => w.date >= cutoff);
  }, [data, cutoff]);

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
            backgroundColor: 'var(--accent, #E0142F)',
            color: 'var(--text-on-accent, #FFFFFF)',
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
          {/* Header — uppercase kicker + serif headline + leaderboard link
              (mirrors mobile headingRow) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--accent-hover, #FF2740)',
                marginBottom: 4,
              }}>
                Performance
              </div>
              <h1 style={{
                fontSize: 28,
                fontWeight: 600,
                margin: 0,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-serif)',
                letterSpacing: '0.02em',
              }}>
                Your Progress
              </h1>
            </div>
            <Link
              href="/gym/leaderboard"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--accent-hover, #FF2740)',
                textDecoration: 'none',
                padding: '6px 0',
              }}
            >
              LEADERBOARD →
            </Link>
          </div>

          {/* Period filter pills — mirrors mobile periodRow */}
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Filter period">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  aria-pressed={active}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    border: active
                      ? '1px solid var(--border-accent, rgba(224, 20, 47, 0.28))'
                      : '1px solid var(--color-border-subtle)',
                    backgroundColor: active
                      ? 'var(--accent-subtle, rgba(224, 20, 47, 0.10))'
                      : 'var(--color-bg-raised)',
                    color: active ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Stats overview — 4-across mono stat pills (mobile statsRow) */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Workouts', value: String(data.stats.total_workouts) },
              { label: 'Volume', value: formatVolume(data.stats.total_volume_lbs, weightUnit) },
              { label: 'Avg / Week', value: String(data.stats.avg_per_week) },
              { label: 'Streak', value: `${data.stats.current_streak}d` },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 12,
                  padding: '12px 4px',
                  textAlign: 'center',
                }}
              >
                <p style={{
                  fontSize: 17,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.value}
                </p>
                <p style={{
                  fontSize: 9,
                  color: 'var(--color-text-secondary)',
                  margin: '3px 0 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Trends — volume trend chart card */}
          {filteredWeeklyVolume.length > 0 && (
            <div>
              <p style={sectionTitle}>Trends</p>
              <VolumeChart data={filteredWeeklyVolume} />
            </div>
          )}

          {/* Personal records — showcase with rank medals (mobile Top Performers) */}
          {filteredPRs.length > 0 && (
            <div>
              <p style={sectionTitle}>Personal Records</p>
              <div style={{ ...cardStyle, padding: '4px 16px' }}>
                {filteredPRs.map((pr, i) => (
                  <div
                    key={`${pr.machine_name}-${pr.date}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 0',
                      borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                    }}
                  >
                    {/* Rank medal circle */}
                    <div
                      aria-hidden="true"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: i < 3
                          ? `1px solid ${MEDAL_COLORS[i]}`
                          : '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-elevated)',
                      }}
                    >
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: i < 3 ? MEDAL_COLORS[i] : 'var(--color-text-secondary)',
                      }}>
                        {i + 1}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {pr.machine_name}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
                        {formatWeight(pr.weight_lbs, weightUnit)} x {pr.reps}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--gold, #E8B339)', fontFamily: 'var(--font-mono)' }}>
                        {pr.est_1rm}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Est. 1RM
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consistency calendar */}
          <WorkoutCalendar dates={data.workout_dates} />

          {/* Recent workouts — session breakdown list (mobile exercise breakdown slot) */}
          {filteredWorkouts.length > 0 && (
            <div>
              <p style={sectionTitle}>Recent Workouts</p>
              <div style={{ ...cardStyle, padding: '4px 16px' }}>
                {filteredWorkouts.map((w, i) => (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 0',
                      borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {w.machine_name && (
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                          {w.machine_name}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {w.sets} sets
                      </span>
                      {w.duration_min > 0 && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
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
