import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import {
  estimate1RM,
  calculateVolume,
  formatWeight,
  computeVolumeTrend,
  compute1RMTrend,
  computeWeightTrend,
  computeStrengthCurve,
} from '@nexera/utils';
import type { TrendDataPoint, SessionForTrend, StrengthCurvePoint } from '@nexera/utils';
import { MiniChart } from '../../src/components/MiniChart';
import type { WorkoutSet } from '@nexera/types';
import { colors } from '../../src/theme/colors';

// ─── Types ──────────────────────────────────────────────

type PeriodDays = 0 | 30 | 60 | 90;

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodDays }> = [
  { label: '90d', value: 90 },
  { label: '60d', value: 60 },
  { label: '30d', value: 30 },
  { label: 'All', value: 0 },
];

interface SessionEntry {
  workoutId: string;
  startedAt: string;
  sets: WorkoutSet[];
}

interface ExerciseData {
  bestWeightKg: number;
  bestRepsAtWeight: number;
  estimated1RM: number;
  totalVolume: number;
  sessionCount: number;
  sessions: SessionEntry[];
  strengthCurve: StrengthCurvePoint[];
}

// ─── Component ──────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const exerciseName = decodeURIComponent(name || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodDays>(90);
  const [data, setData] = useState<ExerciseData | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !exerciseName) {
        setData(null);
        setLoading(false);
        return;
      }

      // Try RPC first, fall back to direct queries
      let sets: Array<{ workout_id: string; started_at: string; set_number: number; reps: number; weight_kg: number; rpe: number | null }> = [];
      let usedRpc = false;

      const sinceDate = period > 0
        ? new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()
        : null;

      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_exercise_progression', {
          p_profile_id: user.id,
          p_exercise_name: exerciseName,
          ...(sinceDate ? { p_since: sinceDate } : {}),
        });

        if (!rpcErr && rpcData) {
          sets = rpcData;
          usedRpc = true;
        }
      } catch {
        // RPC not available, fall back
      }

      if (!usedRpc) {
        // Fallback: direct queries
        let workoutQuery = supabase
          .from('workouts')
          .select('id, started_at')
          .eq('profile_id', user.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: true });

        if (sinceDate) {
          workoutQuery = workoutQuery.gte('started_at', sinceDate);
        }

        const { data: workouts, error: wErr } = await workoutQuery;
        if (wErr) throw wErr;
        if (!workouts || workouts.length === 0) {
          setData(null);
          setLoading(false);
          return;
        }

        const workoutIds = workouts.map((w) => w.id);
        const workoutDateMap = new Map(workouts.map((w) => [w.id, w.started_at]));

        const { data: exerciseData, error: eErr } = await supabase
          .from('workout_exercises')
          .select('id, workout_id, exercise_name, sets(*)')
          .in('workout_id', workoutIds)
          .eq('exercise_name', exerciseName);

        if (eErr) throw eErr;

        for (const we of exerciseData || []) {
          const startedAt = workoutDateMap.get(we.workout_id) || '';
          const weSets = (we.sets ?? []) as Array<{ set_number: number; reps: number; weight_kg: number; rpe: number | null }>;
          for (const s of weSets) {
            sets.push({
              workout_id: we.workout_id,
              started_at: startedAt,
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
              rpe: s.rpe ?? null,
            });
          }
        }
      }

      if (sets.length === 0) {
        setData(null);
        setLoading(false);
        return;
      }

      // Compute stats
      let bestWeightKg = 0;
      let bestRepsAtWeight = 0;
      let best1RM = 0;
      let totalVolume = 0;
      const allSetsForCurve: Array<{ weight_kg: number; reps: number }> = [];

      for (const s of sets) {
        const w = Number(s.weight_kg);
        const r = Number(s.reps);
        totalVolume += w * r;
        allSetsForCurve.push({ weight_kg: w, reps: r });

        if (w > bestWeightKg || (w === bestWeightKg && r > bestRepsAtWeight)) {
          bestWeightKg = w;
          bestRepsAtWeight = r;
        }

        const e = estimate1RM(w, r);
        if (e > best1RM) best1RM = e;
      }

      // Group sets into sessions
      const sessionMap = new Map<string, SessionEntry>();
      for (const s of sets) {
        if (!sessionMap.has(s.workout_id)) {
          sessionMap.set(s.workout_id, {
            workoutId: s.workout_id,
            startedAt: s.started_at,
            sets: [],
          });
        }
        sessionMap.get(s.workout_id)!.sets.push({
          id: `${s.workout_id}-${s.set_number}`,
          workout_exercise_id: s.workout_id,
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: Number(s.weight_kg),
          rpe: s.rpe ? Number(s.rpe) : undefined,
        } as WorkoutSet);
      }

      const sessions = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      for (const session of sessions) {
        session.sets.sort((a, b) => a.set_number - b.set_number);
      }

      const strengthCurve = computeStrengthCurve(allSetsForCurve);

      setData({
        bestWeightKg,
        bestRepsAtWeight,
        estimated1RM: best1RM,
        totalVolume: Math.round(totalVolume),
        sessionCount: sessions.length,
        sessions,
        strengthCurve,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load exercise data');
    } finally {
      setLoading(false);
    }
  }, [exerciseName, period]);

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

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: exerciseName }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: exerciseName }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: exerciseName }} />
        <Text style={styles.emptyTitle}>No Data</Text>
        <Text style={styles.emptySubtitle}>
          No workout data found for {exerciseName}
        </Text>
      </View>
    );
  }

  // Build trend data
  const sessionsForTrend: SessionForTrend[] = data.sessions.map((s) => ({
    startedAt: s.startedAt,
    sets: s.sets,
  }));

  const e1rmTrend = compute1RMTrend(sessionsForTrend);
  const volumeTrend = computeVolumeTrend(sessionsForTrend);
  const weightTrend = computeWeightTrend(sessionsForTrend);

  // Strength curve max for bar scaling
  const curveMax = data.strengthCurve.reduce((m, p) => Math.max(m, p.best1RM), 0);

  // ─── Enrichment: computed stats ─────────────────────────
  const avgVolumePerSession = data.sessionCount > 0
    ? Math.round(data.totalVolume / data.sessionCount)
    : 0;

  const firstSessionTime = data.sessions.length > 0
    ? new Date(data.sessions[data.sessions.length - 1].startedAt).getTime()
    : 0;
  const lastSessionTime = data.sessions.length > 0
    ? new Date(data.sessions[0].startedAt).getTime()
    : 0;
  const spanDays = Math.max(1, (lastSessionTime - firstSessionTime) / (1000 * 60 * 60 * 24));

  const frequencyText = data.sessionCount <= 1
    ? '1 session'
    : spanDays < 7
      ? `${data.sessionCount} sessions this week`
      : `~${(data.sessionCount / (spanDays / 7)).toFixed(1)}x / week`;

  const firstSession = data.sessions[data.sessions.length - 1];
  const latestSession = data.sessions[0];
  const firstBestWeight = firstSession
    ? Math.max(...firstSession.sets.map(s => s.weight_kg), 0)
    : 0;
  const latestBestWeight = latestSession
    ? Math.max(...latestSession.sets.map(s => s.weight_kg), 0)
    : 0;
  const progressPercent = firstBestWeight > 0 && data.sessionCount > 1
    ? ((latestBestWeight - firstBestWeight) / firstBestWeight) * 100
    : null;

  const latestSessionVolume = latestSession
    ? latestSession.sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
    : 0;
  const latestSessionSets = latestSession ? latestSession.sets.length : 0;
  const latestSessionDateStr = latestSession
    ? new Date(latestSession.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <>
      <Stack.Screen options={{ title: exerciseName }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Period Toggle */}
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

        {/* PR Summary Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Records</Text>
          <View style={styles.prRow}>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Best</Text>
              <Text style={styles.prValue}>
                {formatWeight(data.bestWeightKg)} x {data.bestRepsAtWeight}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Est. 1RM</Text>
              <Text style={styles.prValue}>{formatWeight(data.estimated1RM)}</Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Total Vol.</Text>
              <Text style={styles.prValue}>{formatWeight(data.totalVolume)}</Text>
            </View>
          </View>
          <Text style={styles.sessionCountText}>
            {data.sessionCount} {data.sessionCount === 1 ? 'session' : 'sessions'}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatChip}>
            <Text style={styles.quickStatValue}>{frequencyText}</Text>
            <Text style={styles.quickStatLabel}>Frequency</Text>
          </View>
          <View style={styles.quickStatChip}>
            <Text style={styles.quickStatValue}>{formatWeight(avgVolumePerSession)}</Text>
            <Text style={styles.quickStatLabel}>Avg Vol / Session</Text>
          </View>
        </View>

        {/* Progress Callout */}
        {progressPercent !== null && Math.abs(progressPercent) >= 1 && (
          <View style={[
            styles.progressCallout,
            { backgroundColor: progressPercent >= 0 ? '#d4edda' : '#f8d7da' },
          ]}>
            <Text style={[
              styles.progressText,
              { color: progressPercent >= 0 ? '#155724' : '#721c24' },
            ]}>
              {progressPercent >= 0 ? '+' : ''}{Math.round(progressPercent)}% weight improvement since first session
            </Text>
          </View>
        )}

        {/* Charts */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trends</Text>
          <MiniChart
            data={e1rmTrend}
            label="Estimated 1RM"
            unit="kg"
            color={colors.primary}
            height={200}
            maxPoints={30}
          />
          <MiniChart
            data={volumeTrend}
            label="Session Volume"
            unit="kg"
            color={colors.success}
            height={200}
            maxPoints={30}
          />
          <MiniChart
            data={weightTrend}
            label="Best Weight"
            unit="kg"
            color={colors.primaryDark}
            height={200}
            maxPoints={30}
          />
        </View>

        {/* Strength Curve */}
        {data.strengthCurve.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Strength Curve</Text>
            <Text style={styles.curveSubtitle}>Best estimated 1RM by rep range</Text>
            {data.strengthCurve.map((point) => (
              <View key={point.repRange} style={styles.curveRow}>
                <Text style={styles.curveLabel}>{point.repRange} reps</Text>
                <View style={styles.curveBarContainer}>
                  <View
                    style={[
                      styles.curveBar,
                      { width: `${curveMax > 0 ? (point.best1RM / curveMax) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.curveValue}>{formatWeight(point.best1RM)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Last Session Recap */}
        {latestSession && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Last Session</Text>
            <View style={styles.lastSessionRow}>
              <View style={styles.lastSessionStat}>
                <Text style={styles.lastSessionValue}>{latestSessionDateStr}</Text>
                <Text style={styles.lastSessionLabel}>Date</Text>
              </View>
              <View style={styles.lastSessionStat}>
                <Text style={styles.lastSessionValue}>{latestSessionSets}</Text>
                <Text style={styles.lastSessionLabel}>Sets</Text>
              </View>
              <View style={styles.lastSessionStat}>
                <Text style={styles.lastSessionValue}>{formatWeight(latestBestWeight)}</Text>
                <Text style={styles.lastSessionLabel}>Best Weight</Text>
              </View>
              <View style={styles.lastSessionStat}>
                <Text style={styles.lastSessionValue}>{formatWeight(Math.round(latestSessionVolume))}</Text>
                <Text style={styles.lastSessionLabel}>Volume</Text>
              </View>
            </View>
          </View>
        )}

        {/* Session History */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Session History</Text>
          {data.sessions.map((session) => (
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
                    <Text style={styles.setsHeaderText}>Set</Text>
                    <Text style={styles.setsHeaderText}>Weight</Text>
                    <Text style={styles.setsHeaderText}>Reps</Text>
                  </View>
                  {session.sets.map((set) => (
                    <View key={set.id} style={styles.setRow}>
                      <Text style={styles.setNumber}>{set.set_number}</Text>
                      <Text style={styles.setDetail}>{formatWeight(set.weight_kg)}</Text>
                      <Text style={styles.setDetail}>{set.reps}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // ─── Period Toggle ──────────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodBtnTextActive: {
    color: colors.white,
  },
  // ─── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  // ─── PR Row ─────────────────────────────────────────────
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prItem: {
    alignItems: 'center',
    flex: 1,
  },
  prLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  prValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sessionCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  // ─── Strength Curve ─────────────────────────────────────
  curveSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  curveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  curveLabel: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  curveBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  curveBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  curveValue: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  // ─── Session History ────────────────────────────────────
  sessionEntry: {
    marginBottom: 16,
  },
  sessionDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noSetsText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  setsTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setsHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  setNumber: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  setDetail: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },

  // ─── Quick Stats ───────────────────────────────────────
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickStatChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  // ─── Progress Callout ─────────────────────────────────
  progressCallout: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ─── Last Session ─────────────────────────────────────
  lastSessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastSessionStat: {
    alignItems: 'center',
    flex: 1,
  },
  lastSessionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  lastSessionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
