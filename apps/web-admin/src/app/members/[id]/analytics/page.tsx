'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../../components/PageHeader';
import { AnimatedPage } from '../../../components/AnimatedPage';
import {
  estimate1RM,
  computeWeeklyVolume,
  computeWeeklyFrequency,
  computeTrendDirection,
} from '@nexera/utils';
import type { SessionForTrend, TrendDataPoint } from '@nexera/utils';

// ─── Types ──────────────────────────────────────────────

interface ExerciseProgression {
  name: string;
  data: Array<{ date: string; value: number }>;
}

/** One element of workout_sessions.sets JSONB (weights stored in lbs). */
interface SessionSet {
  set_number: number;
  weight_lbs: number;
  reps: number;
  rpe?: number | null;
  notes?: string | null;
  logged_at?: string;
}

interface SessionRow {
  id: string;
  session_date: string;
  sets: SessionSet[];
  created_at: string;
  completed_at: string;
  machines: { name: string } | null;
}

type PeriodDays = 30 | 60 | 90;

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const statValueStyle: CSSProperties = {
  fontSize: 'var(--text-2xl)' as any,
  fontWeight: 'var(--weight-bold)' as any,
  color: 'var(--color-text-primary)',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 'var(--text-sm)' as any,
  color: 'var(--color-text-muted)',
};

const chartCardStyle: CSSProperties = {
  ...cardStyle,
  marginBottom: 24,
};

const periodToggleStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 0,
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 3,
  marginBottom: 20,
};

const periodBtnStyle: CSSProperties = {
  padding: '8px 20px',
  borderRadius: 'var(--radius-sm)' as any,
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  background: 'transparent',
  color: 'var(--color-text-muted)',
  transition: 'all 0.2s',
};

const periodActiveStyle: CSSProperties = {
  ...periodBtnStyle,
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 'var(--text-base)' as any,
  color: 'var(--color-blue-light)',
  textDecoration: 'none',
  fontWeight: 'var(--weight-medium)' as any,
};

const trendBadgeStyle = (dir: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor:
    dir === 'increasing' ? 'var(--color-green-subtle)' : dir === 'decreasing' ? 'var(--color-red-subtle)' : 'var(--color-bg-elevated)',
  color:
    dir === 'increasing' ? 'var(--color-green-light)' : dir === 'decreasing' ? 'var(--color-red-light)' : 'var(--color-text-muted)',
});

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 'var(--radius-lg)' as any,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

// ─── Component ──────────────────────────────────────────

export default function MemberAnalyticsPage() {
  const params = useParams();
  const memberId = params.id as string;

  const [memberName, setMemberName] = useState('');
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [volumeTrend, setVolumeTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');

  // Chart data
  const [weeklyVolume, setWeeklyVolume] = useState<TrendDataPoint[]>([]);
  const [weeklyFreq, setWeeklyFreq] = useState<TrendDataPoint[]>([]);
  const [exerciseProgressions, setExerciseProgressions] = useState<ExerciseProgression[]>([]);

  useEffect(() => {
    fetchData(period);
  }, [memberId, period]);

  async function fetchData(days: PeriodDays) {
    setLoading(true);
    setError(null);
    try {
      // Profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', memberId)
        .maybeSingle();
      setMemberName(profile?.full_name ?? 'Unknown');

      // [id] is a users.id; workout_sessions keys on members.id — map
      // through the members table first.
      const { data: memberRows } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', memberId);

      const memberRowIds = (memberRows ?? []).map((m) => m.id);

      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Completed sessions in period — one row per (machine, day); sets is
      // a JSONB array of { set_number, weight_lbs, reps, ... } (weights in lbs).
      const { data: sessionData, error: sessErr } = await supabase
        .from('workout_sessions')
        .select('id, session_date, sets, created_at, completed_at, machines(name)')
        .in('member_id', memberRowIds)
        .not('completed_at', 'is', null)
        .gte('session_date', sinceDate)
        .order('session_date', { ascending: true });

      if (sessErr) throw sessErr;

      const rows = (sessionData ?? []) as unknown as SessionRow[];

      // A "workout" = a distinct training day
      const dayList = Array.from(new Set(rows.map((r) => r.session_date))).sort();
      setTotalWorkouts(dayList.length);

      // Average workout duration: per day, first machine-session start to
      // last machine-session completion.
      const dayBounds = new Map<string, { start: number; end: number }>();
      for (const r of rows) {
        const start = new Date(r.created_at).getTime();
        const end = new Date(r.completed_at).getTime();
        const b = dayBounds.get(r.session_date);
        if (!b) dayBounds.set(r.session_date, { start, end });
        else {
          b.start = Math.min(b.start, start);
          b.end = Math.max(b.end, end);
        }
      }
      const durations = Array.from(dayBounds.values())
        .map((b) => (b.end - b.start) / 60000)
        .filter((m) => Number.isFinite(m) && m > 0);
      setAvgDuration(durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0);

      if (rows.length === 0) {
        setWeeklyVolume([]);
        setWeeklyFreq([]);
        setExerciseProgressions([]);
        setVolumeTrend('stable');
        setLoading(false);
        return;
      }

      // Build sessions for trend utils. SessionForTrend's set field is
      // named weight_kg for legacy reasons but the math is unit-agnostic —
      // we feed lbs and label the charts accordingly.
      const sessions: SessionForTrend[] = rows.map((r) => ({
        startedAt: r.session_date,
        sets: (r.sets ?? []).map((s) => ({ weight_kg: s.weight_lbs, reps: s.reps })),
      }));

      // Weekly volume
      const wv = computeWeeklyVolume(sessions);
      setWeeklyVolume(wv);
      setVolumeTrend(computeTrendDirection(wv));

      // Weekly frequency (one entry per training day)
      const wf = computeWeeklyFrequency(dayList);
      setWeeklyFreq(wf);

      // Exercise progressions (top 5 by session count), named by machine
      const exerciseMap = new Map<string, Map<string, Array<{ weight_lbs: number; reps: number }>>>();
      for (const r of rows) {
        const eName = r.machines?.name ?? 'Unknown machine';
        if (!exerciseMap.has(eName)) exerciseMap.set(eName, new Map());
        const dateMap = exerciseMap.get(eName)!;
        if (!dateMap.has(r.session_date)) dateMap.set(r.session_date, []);
        for (const s of r.sets ?? []) {
          dateMap.get(r.session_date)!.push({ weight_lbs: s.weight_lbs, reps: s.reps });
        }
      }

      const progressions: ExerciseProgression[] = [];
      for (const [name, dateMap] of exerciseMap) {
        if (dateMap.size < 2) continue;
        const data: Array<{ date: string; value: number }> = [];
        for (const [date, sets] of dateMap) {
          let best1RM = 0;
          for (const s of sets) {
            const e = estimate1RM(s.weight_lbs, s.reps);
            if (e > best1RM) best1RM = e;
          }
          if (best1RM > 0) data.push({ date, value: Math.round(best1RM * 10) / 10 });
        }
        data.sort((a, b) => a.date.localeCompare(b.date));
        if (data.length >= 2) progressions.push({ name, data });
      }

      progressions.sort((a, b) => b.data.length - a.data.length);
      setExerciseProgressions(progressions.slice(0, 5));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Member Analytics" description="Loading..." />
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner-enhanced" /></div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <Link href={`/members/${memberId}`} style={backLinkStyle}>
          &larr; Back to {memberName}
        </Link>

        <PageHeader
          title={`${memberName} — Analytics`}
          description={`Training data for the last ${period} days`}
        />

        {error && (
          <div style={{
            backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)',
            padding: '14px 18px', borderRadius: 'var(--radius-sm)' as any, fontSize: 'var(--text-base)' as any, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Stats strip */}
        {!loading && (
          <div style={statsStripStyle}>
            <span style={statsChipStyle}>{totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''} ({period}d)</span>
            <span style={statsChipStyle}>{avgDuration}m avg duration</span>
            <span style={{
              ...statsChipStyle,
              backgroundColor: volumeTrend === 'increasing' ? 'var(--color-green-subtle)' : volumeTrend === 'decreasing' ? 'var(--color-red-subtle)' : 'var(--color-bg-elevated)',
              color: volumeTrend === 'increasing' ? 'var(--color-green-light)' : volumeTrend === 'decreasing' ? 'var(--color-red-light)' : 'var(--color-text-muted)',
            }}>
              Volume: {volumeTrend}
            </span>
            <span style={statsChipStyle}>{exerciseProgressions.length} exercise{exerciseProgressions.length !== 1 ? 's' : ''} tracked</span>
            <span style={statsChipStyle}>{weeklyVolume.length} week{weeklyVolume.length !== 1 ? 's' : ''} of data</span>
          </div>
        )}

        {/* Period selector */}
        <div style={periodToggleStyle}>
          {([30, 60, 90] as PeriodDays[]).map((d) => (
            <button
              key={d}
              style={period === d ? periodActiveStyle : periodBtnStyle}
              onClick={() => setPeriod(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div style={gridStyle}>
          <div style={cardStyle} className="section-glow">
            <div style={statValueStyle}>{totalWorkouts}</div>
            <div style={statLabelStyle}>Workouts ({period}d)</div>
          </div>
          <div style={cardStyle} className="section-glow">
            <div style={statValueStyle}>{avgDuration}m</div>
            <div style={statLabelStyle}>Avg Duration</div>
          </div>
          <div style={cardStyle} className="section-glow">
            <div style={statValueStyle}>
              <span style={trendBadgeStyle(volumeTrend)}>
                {volumeTrend === 'increasing' ? 'Up' : volumeTrend === 'decreasing' ? 'Down' : 'Stable'}
              </span>
            </div>
            <div style={statLabelStyle}>Volume Trend</div>
          </div>
        </div>

        {/* Weekly Volume Chart */}
        <div style={chartCardStyle} className="section-glow">
          <h3 style={{ fontSize: 16, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)', marginBottom: 16, marginTop: 0 }}>
            Weekly Volume (lbs)
          </h3>
          {weeklyVolume.length >= 2 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 32 }}>
              Not enough data for this period.
            </p>
          )}
        </div>

        {/* Weekly Frequency Chart */}
        <div style={chartCardStyle} className="section-glow">
          <h3 style={{ fontSize: 16, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)', marginBottom: 16, marginTop: 0 }}>
            Weekly Workout Frequency
          </h3>
          {weeklyFreq.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyFreq}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 32 }}>
              Not enough data for this period.
            </p>
          )}
        </div>

        {/* Exercise 1RM Progressions */}
        {exerciseProgressions.length > 0 && (
          <div style={chartCardStyle} className="section-glow">
            <h3 style={{ fontSize: 16, fontWeight: 'var(--weight-medium)' as any, color: 'var(--color-text-primary)', marginBottom: 16, marginTop: 0 }}>
              1RM Progression by Exercise
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis
                  dataKey="date"
                  type="category"
                  allowDuplicatedCategory={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {exerciseProgressions.map((ep, i) => {
                  const colors = ['#E0142F', '#00C896', '#3B82F6', '#FF4D6A', '#E8B339'];
                  return (
                    <Line
                      key={ep.name}
                      data={ep.data}
                      dataKey="value"
                      name={ep.name}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
