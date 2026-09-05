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
import { estimate1RM, formatWeight } from '@nexera/utils';
import type { TrendDataPoint } from '@nexera/utils';
import type { WeightUnit } from '@nexera/types';
import { MiniChart } from '../../src/components/MiniChart';
import { getMemberId } from '../../src/lib/memberData';
import { getWeightUnit } from '../../src/lib/weightUnit';
import {
  parseSessionSets,
  setsVolume,
  volumeTrendPts,
  e1rmTrendPts,
  weightTrendPts,
  strengthCurvePts,
} from '../../src/lib/sessionStats';
import type {
  ParsedSet,
  SessionForStats,
  StrengthCurveBucket,
} from '../../src/lib/sessionStats';
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
  sessionId: string;
  date: string; // YYYY-MM-DD
  sets: ParsedSet[];
}

interface ExerciseData {
  bestWeight: number; // display unit
  bestRepsAtWeight: number;
  estimated1RM: number;
  totalVolume: number;
  sessionCount: number;
  sessions: SessionEntry[]; // newest first
  strengthCurve: StrengthCurveBucket[];
}

/** Device-local calendar date as YYYY-MM-DD (matches session_date semantics). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Anchor a YYYY-MM-DD string to local noon to avoid UTC-midnight drift. */
function localNoon(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00`);
}

// ─── Component ──────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  // Route param is the MACHINE name (exercise identity = machine)
  const exerciseName = decodeURIComponent(name || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodDays>(90);
  const [unit, setUnit] = useState<WeightUnit>('lbs');
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

      const [memberId, resolvedUnit] = await Promise.all([
        getMemberId(user.id),
        getWeightUnit(),
      ]);
      setUnit(resolvedUnit);

      if (!memberId) {
        setData(null);
        setLoading(false);
        return;
      }

      // Single query on canonical workout_sessions, joined to the machine by
      // name. member_id scoping makes gym scoping implicit (members belong to
      // one gym), so same-named machines in other gyms can't leak in.
      let query = supabase
        .from('workout_sessions')
        .select('id, session_date, sets, machines!inner(name)')
        .eq('member_id', memberId)
        .eq('machines.name', exerciseName)
        .not('completed_at', 'is', null)
        .order('session_date', { ascending: true });

      if (period > 0) {
        const since = new Date();
        since.setDate(since.getDate() - period);
        query = query.gte('session_date', toLocalDateStr(since));
      }

      const { data: sessionRows, error: sessionsErr } = await query.limit(500);
      if (sessionsErr) throw sessionsErr;

      const rows = (sessionRows ?? []) as unknown as Array<{
        id: string;
        session_date: string;
        sets: unknown;
      }>;

      if (rows.length === 0) {
        setData(null);
        setLoading(false);
        return;
      }

      // One entry per session row, sets parsed into the display unit
      const sessions: SessionEntry[] = rows
        .map((row) => ({
          sessionId: row.id,
          date: row.session_date,
          sets: parseSessionSets(row.sets, resolvedUnit),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // newest first

      const allSets: ParsedSet[] = sessions.flatMap((s) => s.sets);

      if (allSets.length === 0) {
        setData(null);
        setLoading(false);
        return;
      }

      // Compute stats (display unit)
      let bestWeight = 0;
      let bestRepsAtWeight = 0;
      let best1RM = 0;

      for (const s of allSets) {
        if (s.weight > bestWeight || (s.weight === bestWeight && s.reps > bestRepsAtWeight)) {
          bestWeight = s.weight;
          bestRepsAtWeight = s.reps;
        }
        const e = estimate1RM(s.weight, s.reps);
        if (e > best1RM) best1RM = e;
      }

      setData({
        bestWeight,
        bestRepsAtWeight,
        estimated1RM: best1RM,
        totalVolume: Math.round(setsVolume(allSets)),
        sessionCount: sessions.length,
        sessions,
        strengthCurve: strengthCurvePts(allSets),
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

  // Build trend data (display unit)
  const sessionsForTrend: SessionForStats[] = data.sessions.map((s) => ({
    date: s.date,
    sets: s.sets,
  }));

  const e1rmTrend: TrendDataPoint[] = e1rmTrendPts(sessionsForTrend);
  const volumeTrend: TrendDataPoint[] = volumeTrendPts(sessionsForTrend);
  const weightTrend: TrendDataPoint[] = weightTrendPts(sessionsForTrend);

  // Strength curve max for bar scaling
  const curveMax = data.strengthCurve.reduce((m, p) => Math.max(m, p.best1RM), 0);

  // ─── Enrichment: computed stats ─────────────────────────
  const avgVolumePerSession = data.sessionCount > 0
    ? Math.round(data.totalVolume / data.sessionCount)
    : 0;

  const firstSessionTime = data.sessions.length > 0
    ? localNoon(data.sessions[data.sessions.length - 1].date).getTime()
    : 0;
  const lastSessionTime = data.sessions.length > 0
    ? localNoon(data.sessions[0].date).getTime()
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
    ? Math.max(...firstSession.sets.map(s => s.weight), 0)
    : 0;
  const latestBestWeight = latestSession
    ? Math.max(...latestSession.sets.map(s => s.weight), 0)
    : 0;
  const progressPercent = firstBestWeight > 0 && data.sessionCount > 1
    ? ((latestBestWeight - firstBestWeight) / firstBestWeight) * 100
    : null;

  const latestSessionVolume = latestSession ? setsVolume(latestSession.sets) : 0;
  const latestSessionSets = latestSession ? latestSession.sets.length : 0;
  const latestSessionDateStr = latestSession
    ? localNoon(latestSession.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
                {formatWeight(data.bestWeight, unit)} x {data.bestRepsAtWeight}
              </Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Est. 1RM</Text>
              <Text style={styles.prValue}>{formatWeight(data.estimated1RM, unit)}</Text>
            </View>
            <View style={styles.prItem}>
              <Text style={styles.prLabel}>Total Vol.</Text>
              <Text style={styles.prValue}>{formatWeight(data.totalVolume, unit)}</Text>
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
            <Text style={styles.quickStatValue}>{formatWeight(avgVolumePerSession, unit)}</Text>
            <Text style={styles.quickStatLabel}>Avg Vol / Session</Text>
          </View>
        </View>

        {/* Progress Callout */}
        {progressPercent !== null && Math.abs(progressPercent) >= 1 && (
          <View style={[
            styles.progressCallout,
            { backgroundColor: progressPercent >= 0 ? colors.successSubtle : colors.errorSubtle },
          ]}>
            <Text style={[
              styles.progressText,
              { color: progressPercent >= 0 ? colors.success : colors.error },
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
            unit={unit}
            color={colors.primary}
            height={200}
            maxPoints={30}
          />
          <MiniChart
            data={volumeTrend}
            label="Session Volume"
            unit={unit}
            color={colors.success}
            height={200}
            maxPoints={30}
          />
          <MiniChart
            data={weightTrend}
            label="Best Weight"
            unit={unit}
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
                <Text style={styles.curveValue}>{formatWeight(point.best1RM, unit)}</Text>
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
                <Text style={styles.lastSessionValue}>{formatWeight(latestBestWeight, unit)}</Text>
                <Text style={styles.lastSessionLabel}>Best Weight</Text>
              </View>
              <View style={styles.lastSessionStat}>
                <Text style={styles.lastSessionValue}>{formatWeight(Math.round(latestSessionVolume), unit)}</Text>
                <Text style={styles.lastSessionLabel}>Volume</Text>
              </View>
            </View>
          </View>
        )}

        {/* Session History */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Session History</Text>
          {data.sessions.map((session) => (
            <View key={session.sessionId} style={styles.sessionEntry}>
              <Text style={styles.sessionDate}>
                {localNoon(session.date).toLocaleDateString(undefined, {
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
                    <View key={set.set_number} style={styles.setRow}>
                      <Text style={styles.setNumber}>{set.set_number}</Text>
                      <Text style={styles.setDetail}>{formatWeight(set.weight, unit)}</Text>
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
    color: colors.text,
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
    backgroundColor: colors.surfaceHighest,
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
    backgroundColor: colors.surfaceHighest,
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
