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
  calculateVolume,
  formatWeight,
  computeVolumeTrend,
  compute1RMTrend,
  computeWeightTrend,
  computeWeeklyVolume,
  computeWeeklyFrequency,
  computeTrendDirection,
} from '@nexera/utils';
import type { TrendDataPoint, SessionForTrend } from '@nexera/utils';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { SkeletonGate, ProgressScreenSkeleton } from '../../src/components/skeleton';
import { MiniChart } from '../../src/components/MiniChart';
import type { WorkoutSet } from '@nexera/types';
import { getStreak } from '../../src/lib/streakService';
import type { StreakResult } from '../../src/lib/streakService';
import { isFeatureEnabled } from '../../src/lib/featureFlags';

// ─── Local Types ────────────────────────────────────────

interface CompletedWorkout {
  id: string;
  started_at: string;
}

interface FetchedWorkoutExercise {
  id: string;
  workout_id: string;
  machine_id?: string;
  exercise_name: string;
  order_index: number;
  sets: WorkoutSet[];
}

interface SessionEntry {
  workoutId: string;
  startedAt: string;
  sets: WorkoutSet[];
}

interface ExerciseSummary {
  exerciseName: string;
  sessionCount: number;
  bestWeightKg: number;
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

function formatVolumeShort(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
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
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
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

      // Fetch gym membership (for streak)
      const { data: memberData } = await supabase
        .from('gym_members').select('gym_id').eq('profile_id', user.id).limit(1).maybeSingle();
      const resolvedGymId = memberData?.gym_id ?? null;
      setGymId(resolvedGymId);

      // Fetch calendar dates (always, last 28 days, independent of period filter)
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const { data: calDates } = await supabase
        .from('workouts').select('started_at')
        .eq('profile_id', user.id).eq('status', 'completed')
        .gte('started_at', fourWeeksAgo.toISOString());
      setCalendarDates((calDates ?? []).map(d => d.started_at));

      // Step 1: Fetch completed workout IDs, optionally filtered by period
      let query = supabase
        .from('workouts')
        .select('id, started_at')
        .eq('profile_id', user.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false });

      if (period > 0) {
        const since = new Date();
        since.setDate(since.getDate() - period);
        query = query.gte('started_at', since.toISOString());
      }

      const { data: workouts, error: workoutsErr } = await query.limit(500);

      if (workoutsErr) throw workoutsErr;

      if (!workouts || workouts.length === 0) {
        setExercises([]);
        setCompletedWorkouts([]);
        // Still run streak in background even with no period-filtered workouts
        if (resolvedGymId && isFeatureEnabled('streaks_enabled')) {
          getStreak(user.id, resolvedGymId).then(s => setStreak(s)).catch(() => {});
        }
        setLoading(false);
        return;
      }

      const completedWorkouts = workouts as CompletedWorkout[];
      setCompletedWorkouts(completedWorkouts);
      const workoutIds = completedWorkouts.map((w) => w.id);

      // Build a lookup from workout ID to started_at
      const workoutDateMap = new Map<string, string>();
      for (const w of completedWorkouts) {
        workoutDateMap.set(w.id, w.started_at);
      }

      // Step 2: Fetch workout_exercises + sets for those workouts
      const { data: exerciseData, error: exercisesErr } = await supabase
        .from('workout_exercises')
        .select('id, workout_id, machine_id, exercise_name, order_index, sets(*)')
        .in('workout_id', workoutIds.slice(0, 100));

      if (exercisesErr) throw exercisesErr;

      const fetched = (exerciseData || []) as unknown as FetchedWorkoutExercise[];

      // Step 3: Group by exercise_name
      const grouped = new Map<string, FetchedWorkoutExercise[]>();
      for (const item of fetched) {
        const key = item.exercise_name;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(item);
      }

      // Step 4: Build summaries and compute PRs
      const summaries: ExerciseSummary[] = [];

      for (const [exerciseName, items] of grouped) {
        // Unique workout IDs for session count
        const uniqueWorkoutIds = new Set(items.map((i) => i.workout_id));

        // Collect all sets across all sessions
        const allSets: WorkoutSet[] = items.flatMap((i) => i.sets || []);

        // Calculate total volume using utility
        const totalVolume = calculateVolume(allSets);

        // Find PRs
        let bestWeightKg = 0;
        let bestRepsAtWeight = 0;
        let bestVolumeSet = 0;
        let best1RM = 0;

        for (const set of allSets) {
          const setVolume = set.weight_kg * set.reps;

          if (
            set.weight_kg > bestWeightKg ||
            (set.weight_kg === bestWeightKg && set.reps > bestRepsAtWeight)
          ) {
            bestWeightKg = set.weight_kg;
            bestRepsAtWeight = set.reps;
          }

          if (setVolume > bestVolumeSet) {
            bestVolumeSet = setVolume;
          }

          const e1rm = estimate1RM(set.weight_kg, set.reps);
          if (e1rm > best1RM) {
            best1RM = e1rm;
          }
        }

        // Build session entries (last 10, sorted newest first)
        const sessionMap = new Map<string, SessionEntry>();
        for (const item of items) {
          if (!sessionMap.has(item.workout_id)) {
            sessionMap.set(item.workout_id, {
              workoutId: item.workout_id,
              startedAt: workoutDateMap.get(item.workout_id) || '',
              sets: [],
            });
          }
          sessionMap.get(item.workout_id)!.sets.push(...(item.sets || []));
        }

        const sessions = Array.from(sessionMap.values())
          .sort(
            (a, b) =>
              new Date(b.startedAt).getTime() -
              new Date(a.startedAt).getTime(),
          )
          .slice(0, 10);

        // Sort sets within each session by set_number
        for (const session of sessions) {
          session.sets.sort((a, b) => a.set_number - b.set_number);
        }

        summaries.push({
          exerciseName,
          sessionCount: uniqueWorkoutIds.size,
          bestWeightKg,
          bestRepsAtWeight,
          bestVolumeSet,
          estimated1RM: best1RM,
          totalVolume,
          sessions,
        });
      }

      // Sort by session count descending (most-used exercises first)
      summaries.sort((a, b) => b.sessionCount - a.sessionCount);

      setExercises(summaries);

      // --- Background: Streak + Muscle Groups ---
      const backgroundTasks: Promise<unknown>[] = [];

      // Streak
      if (resolvedGymId && isFeatureEnabled('streaks_enabled')) {
        backgroundTasks.push(
          getStreak(user.id, resolvedGymId).then(s => setStreak(s))
        );
      }

      // Muscle groups from machine muscle_groups
      const uniqueMachineIds = [...new Set(
        fetched.filter(e => e.machine_id).map(e => e.machine_id!)
      )];
      if (uniqueMachineIds.length > 0) {
        backgroundTasks.push(
          Promise.resolve(supabase.from('machines').select('id, muscle_groups')
            .in('id', uniqueMachineIds))
            .then(({ data: machineData }) => {
              if (!machineData) return;
              const machineMap = new Map<string, string[]>();
              for (const m of machineData as Array<{ id: string; muscle_groups: string[] }>) {
                machineMap.set(m.id, m.muscle_groups || []);
              }
              const muscleCountMap = new Map<string, Set<string>>();
              for (const ex of fetched) {
                if (!ex.machine_id) continue;
                const muscles = machineMap.get(ex.machine_id) || [];
                for (const muscle of muscles) {
                  if (!muscleCountMap.has(muscle)) muscleCountMap.set(muscle, new Set());
                  muscleCountMap.get(muscle)!.add(ex.workout_id);
                }
              }
              const groups: MuscleGroupData[] = Array.from(muscleCountMap.entries())
                .map(([muscle, wkIds]) => ({ muscle, sessionCount: wkIds.size }))
                .sort((a, b) => b.sessionCount - a.sessionCount);
              setMuscleGroups(groups);
            })
        );
      }

      await Promise.allSettled(backgroundTasks);
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

  const toggleExpand = (exerciseName: string) => {
    setExpandedExercise((prev) =>
      prev === exerciseName ? null : exerciseName,
    );
  };

  // ─── Computed Data ───────────────────────────────────

  const overallStats = useMemo(() => {
    const totalWorkouts = completedWorkouts.length;
    const totalVolume = exercises.reduce((sum, e) => sum + e.totalVolume, 0);
    const avgVolume = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;
    const exerciseCount = exercises.length;
    return { totalWorkouts, totalVolume, avgVolume, exerciseCount };
  }, [exercises, completedWorkouts]);

  const weeklyVolumeTrend = useMemo(() => {
    const allSessions: SessionForTrend[] = exercises.flatMap(e =>
      e.sessions.map(s => ({ startedAt: s.startedAt, sets: s.sets }))
    );
    return computeWeeklyVolume(allSessions);
  }, [exercises]);

  const weeklyFrequencyTrend = useMemo(() => {
    const dates = completedWorkouts.map(w => w.started_at);
    return computeWeeklyFrequency(dates);
  }, [completedWorkouts]);

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
    const workoutDateSet = new Set(
      calendarDates.map(d => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      })
    );

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
          <Text style={styles.statPillValue}>{formatVolumeShort(overallStats.totalVolume)}</Text>
          <Text style={styles.statPillLabel}>Total Vol</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statPillValue}>{formatVolumeShort(overallStats.avgVolume)}</Text>
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
            <MiniChart data={weeklyVolumeTrend} label="Weekly Volume" unit="kg" color={colors.primary} />
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
            <View key={ex.exerciseName} style={styles.prShowcaseRow}>
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
              <Text style={styles.prShowcaseValue}>{formatWeight(ex.estimated1RM)}</Text>
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
  ), [overallStats, trendsExpanded, weeklyVolumeTrend, weeklyFrequencyTrend, volumeDirection, freqDirection, streak, muscleGroups, topPerformers, calendarGrid, exercises.length]);

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
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Exercise List ────────────────────────────

  const renderExerciseCard = ({ item, index }: { item: ExerciseSummary; index: number }) => {
    const isExpanded = expandedExercise === item.exerciseName;
    const hasPR = item.bestWeightKg > 0;

    return (
      <StaggeredCard index={index}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => toggleExpand(item.exerciseName)}
          activeOpacity={0.7}
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
                {formatWeight(item.bestWeightKg)} x {item.bestRepsAtWeight}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Volume</Text>
              <Text style={styles.prValue}>
                {formatWeight(item.bestVolumeSet)}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Est. 1RM</Text>
              <Text style={styles.prValue}>
                {formatWeight(item.estimated1RM)}
              </Text>
            </View>
          </View>
        )}

        {/* Drill-down link */}
        <TouchableOpacity
          style={styles.drillDownLink}
          onPress={() => router.push(`/exercise/${encodeURIComponent(item.exerciseName)}` as any)}
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
                >
                  <Text style={[styles.chartToggleText, chartMetric === m && styles.chartToggleTextActive]}>
                    {m === '1rm' ? 'Est. 1RM' : m === 'volume' ? 'Volume' : 'Weight'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mini Chart */}
            {(() => {
              const sessionsForTrend: SessionForTrend[] = item.sessions.map((s) => ({
                startedAt: s.startedAt,
                sets: s.sets,
              }));
              const trendData: TrendDataPoint[] =
                chartMetric === '1rm'
                  ? compute1RMTrend(sessionsForTrend)
                  : chartMetric === 'volume'
                    ? computeVolumeTrend(sessionsForTrend)
                    : computeWeightTrend(sessionsForTrend);
              const chartLabel =
                chartMetric === '1rm' ? 'Est. 1RM' : chartMetric === 'volume' ? 'Session Volume' : 'Best Weight';
              const chartColor =
                chartMetric === '1rm' ? colors.primary : chartMetric === 'volume' ? colors.success : colors.primaryDark;
              return (
                <MiniChart
                  data={trendData}
                  label={chartLabel}
                  unit="kg"
                  color={chartColor}
                />
              );
            })()}

            {/* Session History */}
            {item.sessions.map((session) => (
              <View key={session.workoutId} style={styles.sessionEntry}>
                <Text style={styles.sessionDate}>
                  {new Date(session.startedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
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
                      <View key={set.id} style={styles.setRow}>
                        <Text style={styles.setNumber}>
                          {set.set_number}
                        </Text>
                        <Text style={styles.setDetail}>
                          {formatWeight(set.weight_kg)}
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
        <TouchableOpacity onPress={() => router.push('/leaderboard')} style={styles.leaderboardLink}>
          <Text style={styles.leaderboardLinkText}>LEADERBOARD →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
            onPress={() => setPeriod(opt.value)}
          >
            <Text style={[styles.periodBtnText, period === opt.value && styles.periodBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.exerciseName}
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
