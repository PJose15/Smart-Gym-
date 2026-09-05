import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import {
  estimate1RM,
  formatWeight,
  computeWeeklyFrequency,
  computeTrendDirection,
} from '@nexera/utils';
import type { TrendDataPoint } from '@nexera/utils';
import type { WeightUnit } from '@nexera/types';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { SkeletonGate, ProgressScreenSkeleton } from '../../src/components/skeleton';
import { MiniChart } from '../../src/components/MiniChart';
import { getMemberId } from '../../src/lib/memberData';
import { getWeightUnit } from '../../src/lib/weightUnit';
import {
  parseSessionSets,
  setsVolume,
  volumeTrendPts,
  e1rmTrendPts,
  weightTrendPts,
  weeklyVolumePts,
} from '../../src/lib/sessionStats';
import type { ParsedSet, SessionForStats } from '../../src/lib/sessionStats';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { isFeatureEnabled } from '../../src/lib/featureFlags';

// ─── Local Types ────────────────────────────────────────

/** One canonical workout_sessions row (per member, machine, day). */
interface SessionRow {
  id: string;
  machine_id: string | null;
  session_date: string; // YYYY-MM-DD
  sets: unknown; // JSONB — parsed via parseSessionSets
  machines: { name: string | null; muscle_groups: string[] | null } | null;
}

interface SessionEntry {
  sessionId: string;
  date: string; // YYYY-MM-DD
  sets: ParsedSet[];
}

interface ExerciseSummary {
  machineId: string;
  exerciseName: string; // machine name (exercise identity = machine)
  sessionCount: number;
  bestWeight: number; // display unit
  bestRepsAtWeight: number;
  bestVolumeSet: number;
  estimated1RM: number;
  totalVolume: number;
  sessions: SessionEntry[];
}

type ChartMetric = '1rm' | 'volume' | 'weight';
type PeriodDays = 0 | 30 | 60 | 90;

interface MuscleGroupData { muscle: string; sessionCount: number }
interface CalendarDay { date: string; hasWorkout: boolean; dayOfWeek: number; weekIndex: number }

function formatVolumeShort(value: number, unit: WeightUnit): string {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}k ${unit}`
    : `${Math.round(value)} ${unit}`;
}

/** Device-local calendar date as YYYY-MM-DD (matches session_date semantics). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format a YYYY-MM-DD date without UTC-midnight timezone drift. */
function formatSessionDate(dateStr: string): string {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodDays }> = [
  { label: 'All', value: 0 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
];

// ─── Component ──────────────────────────────────────────

export default function ProgressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('1rm');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodDays>(0);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [allSessions, setAllSessions] = useState<SessionForStats[]>([]);
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [gymId, setGymId] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupData[]>([]);
  const [calendarDates, setCalendarDates] = useState<string[]>([]);
  const [trendsExpanded, setTrendsExpanded] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserId(null);
        setExercises([]);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Resolve members.id (workout_sessions FK) + display unit up front
      const [memberId, resolvedUnit] = await Promise.all([
        getMemberId(user.id),
        getWeightUnit(),
      ]);
      setUnit(resolvedUnit);

      // Fetch gym membership (for streak)
      const { data: memberData } = await supabase
        .from('gym_members').select('gym_id').eq('profile_id', user.id).limit(1).maybeSingle();
      const resolvedGymId = memberData?.gym_id ?? null;
      setGymId(resolvedGymId);

      if (!memberId) {
        setExercises([]);
        setWorkoutDates([]);
        setAllSessions([]);
        setCalendarDates([]);
        setMuscleGroups([]);
        setLoading(false);
        return;
      }

      // Fetch calendar dates (always, last 28 days, independent of period filter)
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const { data: calDates } = await supabase
        .from('workout_sessions').select('session_date')
        .eq('member_id', memberId)
        .not('completed_at', 'is', null)
        .gte('session_date', toLocalDateStr(fourWeeksAgo));
      setCalendarDates((calDates ?? []).map(d => d.session_date as string));

      // Fetch completed session rows (one per member/machine/day), with the
      // joined machine for name + muscle groups, optionally period-filtered
      let query = supabase
        .from('workout_sessions')
        .select('id, machine_id, session_date, sets, machines(name, muscle_groups)')
        .eq('member_id', memberId)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: false });

      if (period > 0) {
        const since = new Date();
        since.setDate(since.getDate() - period);
        query = query.gte('session_date', toLocalDateStr(since));
      }

      const { data: sessionRows, error: sessionsErr } = await query.limit(500);

      if (sessionsErr) throw sessionsErr;

      const rows = (sessionRows ?? []) as unknown as SessionRow[];

      if (rows.length === 0) {
        setExercises([]);
        setWorkoutDates([]);
        setAllSessions([]);
        setMuscleGroups([]);
        // Still run streak in background even with no period-filtered sessions
        if (resolvedGymId && isFeatureEnabled('streaks_enabled')) {
          getStreak(user.id, resolvedGymId).then(s => setStreak(s)).catch(() => {});
        }
        setLoading(false);
        return;
      }

      // Distinct training days ≈ "workouts" (rows are per machine per day)
      setWorkoutDates([...new Set(rows.map((r) => r.session_date))]);

      // Parse each row's sets JSONB once, into display-unit sets
      const parsedRows = rows.map((row) => ({
        row,
        parsedSets: parseSessionSets(row.sets, resolvedUnit),
      }));

      setAllSessions(
        parsedRows.map((p) => ({ date: p.row.session_date, sets: p.parsedSets })),
      );

      // Group by machine (exercise identity = machine)
      const grouped = new Map<string, typeof parsedRows>();
      for (const p of parsedRows) {
        const key = p.row.machine_id ?? 'unknown';
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(p);
      }

      // Build summaries and compute PRs (all values in display unit)
      const summaries: ExerciseSummary[] = [];

      for (const [machineId, items] of grouped) {
        const exerciseName =
          items.find((i) => i.row.machines?.name)?.row.machines?.name ?? 'Unknown machine';

        const allSets: ParsedSet[] = items.flatMap((i) => i.parsedSets);

        let bestWeight = 0;
        let bestRepsAtWeight = 0;
        let bestVolumeSet = 0;
        let best1RM = 0;

        for (const set of allSets) {
          const setVolume = set.weight * set.reps;

          if (
            set.weight > bestWeight ||
            (set.weight === bestWeight && set.reps > bestRepsAtWeight)
          ) {
            bestWeight = set.weight;
            bestRepsAtWeight = set.reps;
          }

          if (setVolume > bestVolumeSet) {
            bestVolumeSet = setVolume;
          }

          const e1rm = estimate1RM(set.weight, set.reps);
          if (e1rm > best1RM) {
            best1RM = e1rm;
          }
        }

        // Session entries (last 10, newest first — rows are already one per session)
        const sessions: SessionEntry[] = items
          .map((i) => ({
            sessionId: i.row.id,
            date: i.row.session_date,
            sets: i.parsedSets,
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10);

        summaries.push({
          machineId,
          exerciseName,
          sessionCount: items.length,
          bestWeight,
          bestRepsAtWeight,
          bestVolumeSet,
          estimated1RM: best1RM,
          totalVolume: setsVolume(allSets),
          sessions,
        });
      }

      // Sort by session count descending (most-used exercises first)
      summaries.sort((a, b) => b.sessionCount - a.sessionCount);

      setExercises(summaries);

      // Muscle groups — computed inline from the joined machines rows;
      // count distinct session rows per muscle
      const muscleCountMap = new Map<string, Set<string>>();
      for (const p of parsedRows) {
        const muscles = p.row.machines?.muscle_groups ?? [];
        for (const muscle of muscles) {
          if (!muscleCountMap.has(muscle)) muscleCountMap.set(muscle, new Set());
          muscleCountMap.get(muscle)!.add(p.row.id);
        }
      }
      const groups: MuscleGroupData[] = Array.from(muscleCountMap.entries())
        .map(([muscle, sessionIds]) => ({ muscle, sessionCount: sessionIds.size }))
        .sort((a, b) => b.sessionCount - a.sessionCount);
      setMuscleGroups(groups);

      // Background: streak
      if (resolvedGymId && isFeatureEnabled('streaks_enabled')) {
        getStreak(user.id, resolvedGymId).then(s => setStreak(s)).catch(() => {});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleExpand = (machineId: string) => {
    setExpandedExercise((prev) => (prev === machineId ? null : machineId));
  };

  // ─── Computed Data ───────────────────────────────────

  const overallStats = useMemo(() => {
    const totalWorkouts = workoutDates.length; // distinct training days
    const totalVolume = exercises.reduce((sum, e) => sum + e.totalVolume, 0);
    const avgVolume = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;
    const exerciseCount = exercises.length;
    return { totalWorkouts, totalVolume, avgVolume, exerciseCount };
  }, [exercises, workoutDates]);

  const weeklyVolumeTrend = useMemo(() => weeklyVolumePts(allSessions), [allSessions]);

  const weeklyFrequencyTrend = useMemo(
    () => computeWeeklyFrequency(workoutDates),
    [workoutDates],
  );

  const volumeDirection = useMemo(() => computeTrendDirection(weeklyVolumeTrend), [weeklyVolumeTrend]);
  const freqDirection = useMemo(() => computeTrendDirection(weeklyFrequencyTrend), [weeklyFrequencyTrend]);

  const topPerformers = useMemo(() => {
    return exercises
      .filter(e => e.estimated1RM > 0)
      .sort((a, b) => b.estimated1RM - a.estimated1RM)
      .slice(0, 5);
  }, [exercises]);

  const calendarGrid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // session_date is already a plain YYYY-MM-DD string
    const workoutDateSet = new Set(calendarDates.map(d => d.slice(0, 10)));

    const weeks: CalendarDay[][] = [[], [], [], []];
    for (let i = 27; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekIndex = Math.floor((27 - i) / 7);
      weeks[weekIndex].push({
        date: dateStr,
        hasWorkout: workoutDateSet.has(dateStr),
        dayOfWeek: adjustedDay,
        weekIndex,
      });
    }
    return weeks;
  }, [calendarDates]);

  const trendBadgeColor = (dir: 'increasing' | 'decreasing' | 'stable') =>
    dir === 'increasing' ? colors.success : dir === 'decreasing' ? colors.error : colors.textSecondary;
  const trendArrow = (dir: 'increasing' | 'decreasing' | 'stable') =>
    dir === 'increasing' ? '↑' : dir === 'decreasing' ? '↓' : '→';

  // ─── List Header (6 enrichments) ────────────────────────

  const renderListHeader = useCallback(() => (
    <View>
      {/* 1. Overall Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{overallStats.totalWorkouts}</Text>
          <Text style={styles.statPillLabel}>Workouts</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{formatVolumeShort(overallStats.totalVolume, unit)}</Text>
          <Text style={styles.statPillLabel}>Total Vol</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{formatVolumeShort(overallStats.avgVolume, unit)}</Text>
          <Text style={styles.statPillLabel}>Avg/Session</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{overallStats.exerciseCount}</Text>
          <Text style={styles.statPillLabel}>Exercises</Text>
        </View>
      </View>

      {/* 2. Volume / Frequency Trends */}
      <TouchableOpacity
        style={styles.trendsSectionHeader}
        onPress={() => setTrendsExpanded(prev => !prev)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={trendsExpanded ? 'Collapse trends' : 'Expand trends'}
        accessibilityState={{ expanded: trendsExpanded }}
      >
        <Text style={styles.sectionTitle}>Trends</Text>
        <Text style={styles.trendsToggle}>{trendsExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {trendsExpanded && (
        <View style={styles.trendsContent}>
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendLabel}>Weekly Volume</Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor: trendBadgeColor(volumeDirection) + '1A',
                    borderColor: trendBadgeColor(volumeDirection) + '55',
                  },
                ]}
              >
                <Text style={[styles.trendBadgeText, { color: trendBadgeColor(volumeDirection) }]}>
                  {trendArrow(volumeDirection)}
                </Text>
              </View>
            </View>
            <MiniChart data={weeklyVolumeTrend} label="Weekly Volume" unit={unit} color={colors.primary} />
          </View>
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendLabel}>Weekly Frequency</Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor: trendBadgeColor(freqDirection) + '1A',
                    borderColor: trendBadgeColor(freqDirection) + '55',
                  },
                ]}
              >
                <Text style={[styles.trendBadgeText, { color: trendBadgeColor(freqDirection) }]}>
                  {trendArrow(freqDirection)}
                </Text>
              </View>
            </View>
            <MiniChart data={weeklyFrequencyTrend} label="Weekly Frequency" unit="sessions" color={colors.success} />
          </View>
        </View>
      )}

      {/* 3. Streak Visualization */}
      {streak && streak.currentStreak > 0 && (
        <View style={styles.streakCard}>
          <Text style={styles.sectionTitle}>Streak</Text>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak.currentStreak}</Text>
              <Text style={styles.streakLabel}>Current{'\n'}Weeks</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak.longestStreak}</Text>
              <Text style={styles.streakLabel}>Longest{'\n'}Weeks</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={[styles.streakValue, { color: streak.currentWeekActive ? colors.success : colors.gold }]}>
                {streak.currentWeekActive ? '✓' : '○'}
              </Text>
              <Text style={styles.streakLabel}>This{'\n'}Week</Text>
            </View>
          </View>
        </View>
      )}

      {/* 4. Muscle Group Coverage */}
      {muscleGroups.length > 0 && (
        <View style={styles.muscleCard}>
          <Text style={styles.sectionTitle}>Muscle Groups</Text>
          {muscleGroups.map(mg => {
            const maxCount = muscleGroups[0].sessionCount;
            const barWidth = maxCount > 0 ? (mg.sessionCount / maxCount) * 100 : 0;
            return (
              <View key={mg.muscle} style={styles.muscleRow}>
                <Text style={styles.muscleName}>{mg.muscle}</Text>
                <View style={styles.muscleBarBg}>
                  <View style={[styles.muscleBarFill, { width: `${barWidth}%` }]} />
                </View>
                <Text style={styles.muscleCount}>{mg.sessionCount}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 5. Personal Records Showcase */}
      {topPerformers.length > 0 && (
        <View style={styles.prShowcaseCard}>
          <Text style={styles.sectionTitle}>Top Performers</Text>
          {topPerformers.map((ex, i) => {
            const medal = i === 0 ? colors.gold : i === 1 ? colors.silver : i === 2 ? colors.bronze : null;
            return (
            <View key={ex.machineId} style={styles.prShowcaseRow}>
              <View
                style={[
                  styles.prShowcaseRank,
                  medal
                    ? { backgroundColor: medal + '1A', borderColor: medal + '66' }
                    : { backgroundColor: colors.surfaceHighest, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.prShowcaseRankText, medal != null && { color: medal }]}>{i + 1}</Text>
              </View>
              <View style={styles.prShowcaseInfo}>
                <Text style={styles.prShowcaseName} numberOfLines={1}>{ex.exerciseName}</Text>
                <Text style={styles.prShowcaseDetail}>Est. 1RM</Text>
              </View>
              <Text style={styles.prShowcaseValue}>{formatWeight(ex.estimated1RM, unit)}</Text>
            </View>
            );
          })}
        </View>
      )}

      {/* 6. Consistency Calendar */}
      <View style={styles.calendarCard}>
        <Text style={styles.sectionTitle}>Last 4 Weeks</Text>
        <View style={styles.calendarDayLabels}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} style={styles.calendarDayLabel}>{d}</Text>
          ))}
        </View>
        {calendarGrid.map((week, wi) => (
          <View key={wi} style={styles.calendarWeekRow}>
            {week.map((day, di) => (
              <View
                key={di}
                style={[styles.calendarDot, day.hasWorkout && styles.calendarDotActive]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Exercise Breakdown label */}
      {exercises.length > 0 && (
        <Text style={styles.breakdownLabel}>Exercise Breakdown</Text>
      )}
    </View>
  ), [overallStats, trendsExpanded, weeklyVolumeTrend, weeklyFrequencyTrend, volumeDirection, freqDirection, streak, muscleGroups, topPerformers, calendarGrid, exercises.length, unit]);

  // ─── Render: Not Signed In ────────────────────────────

  if (!loading && !userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Track Your Progress</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to track progress
        </Text>
      </View>
    );
  }

  // ─── Render: Loading ──────────────────────────────────

  // ─── Render: Error ────────────────────────────────────

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadData}
          accessibilityRole="button"
          accessibilityLabel="Retry loading progress"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Exercise List ────────────────────────────

  const renderExerciseCard = ({ item, index }: { item: ExerciseSummary; index: number }) => {
    const isExpanded = expandedExercise === item.machineId;
    const hasPR = item.bestWeight > 0;

    return (
      <StaggeredCard index={index}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => toggleExpand(item.machineId)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.exerciseName}, ${isExpanded ? 'hide details' : 'show details'}`}
          accessibilityState={{ expanded: isExpanded }}
        >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.exerciseName}>{item.exerciseName}</Text>
            <Text style={styles.sessionCount}>
              {item.sessionCount}{' '}
              {item.sessionCount === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          {hasPR && (
            <View style={styles.prBadge}>
              <Text style={styles.prBadgeText}>PR</Text>
            </View>
          )}
        </View>

        {/* PR Summary */}
        {hasPR && (
          <View style={styles.prRow}>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Best</Text>
              <Text style={styles.prValue}>
                {formatWeight(item.bestWeight, unit)} x {item.bestRepsAtWeight}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Volume</Text>
              <Text style={styles.prValue}>
                {formatWeight(item.bestVolumeSet, unit)}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Est. 1RM</Text>
              <Text style={styles.prValue}>
                {formatWeight(item.estimated1RM, unit)}
              </Text>
            </View>
          </View>
        )}

        {/* Drill-down link */}
        <TouchableOpacity
          style={styles.drillDownLink}
          onPress={() => router.push(`/exercise/${encodeURIComponent(item.exerciseName)}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`View full history for ${item.exerciseName}`}
        >
          <Text style={styles.drillDownText}>View full history ›</Text>
        </TouchableOpacity>

        {/* Expand indicator */}
        <Text style={styles.expandIndicator}>
          {isExpanded ? 'Hide details' : 'Tap for details'}
        </Text>

        {/* Expanded: Chart + Session Details */}
        {isExpanded && (
          <View style={styles.sessionList}>
            {/* Chart Metric Toggle */}
            <View style={styles.chartToggleRow}>
              {(['1rm', 'volume', 'weight'] as ChartMetric[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chartToggleBtn, chartMetric === m && styles.chartToggleBtnActive]}
                  onPress={() => setChartMetric(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${m === '1rm' ? 'estimated 1 rep max' : m} chart`}
                  accessibilityState={{ selected: chartMetric === m }}
                >
                  <Text style={[styles.chartToggleText, chartMetric === m && styles.chartToggleTextActive]}>
                    {m === '1rm' ? 'Est. 1RM' : m === 'volume' ? 'Volume' : 'Weight'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mini Chart */}
            {(() => {
              const sessionsForTrend: SessionForStats[] = item.sessions.map((s) => ({
                date: s.date,
                sets: s.sets,
              }));
              const trendData: TrendDataPoint[] =
                chartMetric === '1rm'
                  ? e1rmTrendPts(sessionsForTrend)
                  : chartMetric === 'volume'
                    ? volumeTrendPts(sessionsForTrend)
                    : weightTrendPts(sessionsForTrend);
              const chartLabel =
                chartMetric === '1rm' ? 'Est. 1RM' : chartMetric === 'volume' ? 'Session Volume' : 'Best Weight';
              const chartColor =
                chartMetric === '1rm' ? colors.primary : chartMetric === 'volume' ? colors.success : colors.primaryDark;
              return (
                <MiniChart
                  data={trendData}
                  label={chartLabel}
                  unit={unit}
                  color={chartColor}
                />
              );
            })()}

            {/* Session History */}
            {item.sessions.map((session) => (
              <View key={session.sessionId} style={styles.sessionEntry}>
                <Text style={styles.sessionDate}>
                  {formatSessionDate(session.date)}
                </Text>
                {session.sets.length === 0 ? (
                  <Text style={styles.noSetsText}>No sets recorded</Text>
                ) : (
                  <View style={styles.setsTable}>
                    <View style={styles.setsTableHeader}>
                      <Text style={styles.setsTableHeaderText}>Set</Text>
                      <Text style={styles.setsTableHeaderText}>Weight</Text>
                      <Text style={styles.setsTableHeaderText}>Reps</Text>
                    </View>
                    {session.sets.map((set) => (
                      <View key={set.set_number} style={styles.setRow}>
                        <Text style={styles.setNumber}>
                          {set.set_number}
                        </Text>
                        <Text style={styles.setDetail}>
                          {formatWeight(set.weight, unit)}
                        </Text>
                        <Text style={styles.setDetail}>{set.reps}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        </TouchableOpacity>
      </StaggeredCard>
    );
  };

  return (
    <SkeletonGate loading={loading} skeleton={<ProgressScreenSkeleton />}>
    <AnimatedScreen>
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.headingKicker}>PERFORMANCE</Text>
          <Text style={styles.heading}>Your Progress</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/leaderboard')}
          style={styles.leaderboardLink}
          accessibilityRole="button"
          accessibilityLabel="Open leaderboard"
        >
          <Text style={styles.leaderboardLinkText}>LEADERBOARD →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
            onPress={() => setPeriod(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${opt.label} period`}
            accessibilityState={{ selected: period === opt.value }}
          >
            <Text style={[styles.periodBtnText, period === opt.value && styles.periodBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.machineId}
        renderItem={renderExerciseCard}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={6}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          <View style={styles.emptyListMsg}>
            <Text style={styles.emptyTitle}>No Workouts Yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete your first workout to see progress
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
    </AnimatedScreen>
    </SkeletonGate>
  );
}

// ─── StaggeredCard helper ─────────────────────────────────

function StaggeredCard({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-60)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const delay = index * 120;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(translateX, { toValue: 0, delay, tension: 45, friction: 7, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, delay, tension: 45, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }, { scale }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: 4,
  },
  headingKicker: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 2.4,
    color: colors.primaryLight,
    marginBottom: 4,
  },
  heading: {
    fontFamily: typography.fontSerif,
    fontSize: 28,
    color: colors.text,
    letterSpacing: 0.5,
  },
  leaderboardLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  leaderboardLinkText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.primaryLight,
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  periodBtnActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  periodBtnText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  periodBtnTextActive: {
    color: colors.primaryLight,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontFamily: typography.fontSerif,
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    fontFamily: typography.fontRegular,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.textOnAccent,
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
  },
  // ─── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  sessionCount: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  prBadge: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    marginLeft: 12,
  },
  prBadgeText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
  },
  // ─── PR Row ─────────────────────────────────────────────
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  prItem: {
    alignItems: 'center',
    flex: 1,
  },
  prLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.fontSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prValue: {
    fontSize: 15,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.4,
    color: colors.text,
  },
  // ─── Drill-down ────────────────────────────────────────
  drillDownLink: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  drillDownText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
  },
  // ─── Expand ─────────────────────────────────────────────
  expandIndicator: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: typography.fontMedium,
  },
  // ─── Session Details ────────────────────────────────────
  sessionList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 10,
  },
  sessionEntry: {
    marginBottom: 16,
  },
  sessionDate: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noSetsText: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  setsTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setsTableHeaderText: {
    flex: 1,
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  setNumber: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryLight,
    fontFamily: typography.fontMonoBold,
  },
  setDetail: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: typography.fontMono,
  },
  // ─── Chart Toggle ─────────────────────────────────────────
  chartToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: 8,
  },
  chartToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 9999,
    alignItems: 'center',
  },
  chartToggleBtnActive: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  chartToggleText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.textMuted,
  },
  chartToggleTextActive: {
    color: colors.primaryLight,
  },
  // ─── Stats Summary ────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  statPillValue: {
    fontSize: 18,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
    color: colors.text,
  },
  statPillLabel: {
    fontSize: 9,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  // ─── Trends ───────────────────────────────────────────────
  trendsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  trendsToggle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  trendsContent: {
    gap: 12,
    marginBottom: 16,
  },
  trendCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendLabel: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  trendBadgeText: {
    fontSize: 12,
    fontFamily: typography.fontMonoBold,
  },
  // ─── Streak ───────────────────────────────────────────────
  streakCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  streakItem: {
    alignItems: 'center',
    flex: 1,
  },
  streakValue: {
    fontSize: 28,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.8,
    color: colors.primaryLight,
  },
  streakLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  // ─── Muscle Groups ────────────────────────────────────────
  muscleCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  muscleName: {
    width: 84,
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  muscleBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  muscleBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  muscleCount: {
    width: 28,
    fontSize: 12,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
    textAlign: 'right',
  },
  // ─── PR Showcase ──────────────────────────────────────────
  prShowcaseCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  prShowcaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  prShowcaseRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prShowcaseRankText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.fontMonoBold,
  },
  prShowcaseInfo: {
    flex: 1,
  },
  prShowcaseName: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  prShowcaseDetail: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 1,
  },
  prShowcaseValue: {
    fontSize: 15,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.4,
    color: colors.text,
  },
  // ─── Consistency Calendar ─────────────────────────────────
  calendarCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  calendarDayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayLabel: {
    width: 28,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  calendarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  calendarDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  // ─── Breakdown Label ──────────────────────────────────────
  breakdownLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  // ─── Empty List ───────────────────────────────────────────
  emptyListMsg: {
    alignItems: 'center',
    paddingVertical: 32,
  },
});
