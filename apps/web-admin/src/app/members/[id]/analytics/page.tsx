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
} from '@smartgym/utils';
import type { SessionForTrend, TrendDataPoint } from '@smartgym/utils';

// ─── Types ──────────────────────────────────────────────

interface ExerciseProgression {
  name: string;
  data: Array<{ date: string; value: number }>;
}

type PeriodDays = 30 | 60 | 90;

// ─── Styles ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const statValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1a1a2e',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#999',
};

const chartCardStyle: CSSProperties = {
  ...cardStyle,
  marginBottom: 24,
};

const periodToggleStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 0,
  backgroundColor: '#f0f0f0',
  borderRadius: 10,
  padding: 3,
  marginBottom: 20,
};

const periodBtnStyle: CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  background: 'transparent',
  color: '#888',
  transition: 'all 0.2s',
};

const periodActiveStyle: CSSProperties = {
  ...periodBtnStyle,
  backgroundColor: '#4361ee',
  color: '#fff',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 14,
  color: '#4361ee',
  textDecoration: 'none',
  fontWeight: 600,
};

const trendBadgeStyle = (dir: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor:
    dir === 'increasing' ? '#e8f5e9' : dir === 'decreasing' ? '#fce4e6' : '#f5f5f5',
  color:
    dir === 'increasing' ? '#2e7d32' : dir === 'decreasing' ? '#c62828' : '#888',
});

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
        .single();
      setMemberName(profile?.full_name ?? 'Unknown');

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Workouts in period
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id, started_at, finished_at')
        .eq('profile_id', memberId)
        .eq('status', 'completed')
        .gte('started_at', since)
        .order('started_at', { ascending: true });

      const wks = workouts ?? [];
      setTotalWorkouts(wks.length);

      // Average duration
      const durations = wks
        .filter((w) => w.finished_at)
        .map((w) => (new Date(w.finished_at!).getTime() - new Date(w.started_at).getTime()) / 60000);
      setAvgDuration(durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0);

      if (wks.length === 0) {
        setWeeklyVolume([]);
        setWeeklyFreq([]);
        setExerciseProgressions([]);
        setVolumeTrend('stable');
        setLoading(false);
        return;
      }

      const workoutIds = wks.map((w) => w.id);

      // Exercises + sets
      const { data: exData } = await supabase
        .from('workout_exercises')
        .select('workout_id, exercise_name, sets(*)')
        .in('workout_id', workoutIds);

      const exercises = exData ?? [];

      // Build sessions for trend utils
      const sessions: SessionForTrend[] = wks.map((w) => ({
        startedAt: w.started_at,
        sets: exercises
          .filter((e: { workout_id: string }) => e.workout_id === w.id)
          .flatMap((e: { sets: Array<{ weight_kg: number; reps: number }> }) => e.sets ?? []),
      }));

      // Weekly volume
      const wv = computeWeeklyVolume(sessions);
      setWeeklyVolume(wv);
      setVolumeTrend(computeTrendDirection(wv));

      // Weekly frequency
      const wf = computeWeeklyFrequency(wks.map((w) => w.started_at));
      setWeeklyFreq(wf);

      // Exercise progressions (top 5 by session count)
      const exerciseMap = new Map<string, Map<string, { weight_kg: number; reps: number }[]>>();
      for (const ex of exercises) {
        const wk = wks.find((w) => w.id === (ex as { workout_id: string }).workout_id);
        if (!wk) continue;
        const date = wk.started_at.slice(0, 10);
        const eName = (ex as { exercise_name: string }).exercise_name;
        if (!exerciseMap.has(eName)) exerciseMap.set(eName, new Map());
        const dateMap = exerciseMap.get(eName)!;
        if (!dateMap.has(date)) dateMap.set(date, []);
        for (const s of ((ex as { sets: Array<{ weight_kg: number; reps: number }> }).sets ?? [])) {
          dateMap.get(date)!.push(s);
        }
      }

      const progressions: ExerciseProgression[] = [];
      for (const [name, dateMap] of exerciseMap) {
        if (dateMap.size < 2) continue;
        const data: Array<{ date: string; value: number }> = [];
        for (const [date, sets] of dateMap) {
          let best1RM = 0;
          for (const s of sets) {
            const e = estimate1RM(s.weight_kg, s.reps);
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
            backgroundColor: '#fdecea', color: '#b71c1c',
            padding: '14px 18px', borderRadius: 8, fontSize: 14, marginBottom: 16,
          }}>
            {error}
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
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 16, marginTop: 0 }}>
            Weekly Volume (kg)
          </h3>
          {weeklyVolume.length >= 2 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4361ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>
              Not enough data for this period.
            </p>
          )}
        </div>

        {/* Weekly Frequency Chart */}
        <div style={chartCardStyle} className="section-glow">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 16, marginTop: 0 }}>
            Weekly Workout Frequency
          </h3>
          {weeklyFreq.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyFreq}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>
              Not enough data for this period.
            </p>
          )}
        </div>

        {/* Exercise 1RM Progressions */}
        {exerciseProgressions.length > 0 && (
          <div style={chartCardStyle} className="section-glow">
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 16, marginTop: 0 }}>
              1RM Progression by Exercise
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  type="category"
                  allowDuplicatedCategory={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {exerciseProgressions.map((ep, i) => {
                  const colors = ['#4361ee', '#2a9d8f', '#3a0ca3', '#e63946', '#e9c46a'];
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
