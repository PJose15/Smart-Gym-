/**
 * Workout complete — sessions-model summary.
 *
 * All awarding (points, streak, achievements, level, feed) happens
 * SERVER-SIDE in /api/sessions/:id/complete; this screen renders the
 * stashed CompleteSessionResults plus today's completed workout_sessions
 * rows (so a cold re-open still shows the summary).
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { formatDuration } from '@nexera/utils';
import { trackEvent } from '../../../src/lib/events';
import {
  buildWorkoutShare,
  shareDateUtc,
  convertFromLbs,
  formatWeightLbs,
  formatVolumeLbs,
} from '../../../src/lib/feedLogic';
import {
  fetchFeedContext,
  hasSharedToday,
  shareWorkoutToFeed,
  type FeedContext,
  type ShareWorkoutResult,
} from '../../../src/lib/feedService';
import {
  localSessionDate,
  type CompleteSessionResult,
  type PrResult,
  type SessionSetEntry,
} from '../../../src/lib/sessionApi';
import {
  resolveWorkoutIdentity,
  consumeCompletionResults,
  consumePrResults,
  aggregateDay,
} from '../../../src/lib/activeWorkout';
import { getWeightUnit } from '../../../src/lib/weightUnit';
import {
  AchievementUnlock,
  type UnlockedAchievement,
} from '../../../src/components/celebrations/AchievementUnlock';
import type { WeightUnit } from '@nexera/types';
import { AnimatedScreen } from '../../../src/components/AnimatedScreen';
import { AnimatedNumber } from '../../../src/components/AnimatedNumber';
import { colors } from '../../../src/theme/colors';
import { typography } from '../../../src/theme/typography';

// ─── Types ──────────────────────────────────────────────

interface CompletedSessionRow {
  id: string;
  machine_id: string;
  sets: SessionSetEntry[] | null;
  sets_count: number | null;
  total_volume_lbs: number | null;
  best_weight_lbs: number | null;
  is_personal_best: boolean | null;
  completed_at: string | null;
  session_date: string;
}

interface ServerAchievement {
  code: string;
  title: string;
  points: number;
}

interface DayComparison {
  volumeChangePct: number | null;
  setsChangePct: number | null;
}

// ─── Stat Card ──────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  numericValue?: number;
  suffix?: string;
  index?: number;
}

function StatCard({ label, value, numericValue, suffix, index = 0 }: StatCardProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 120;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        tension: 60,
        friction: 6,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.statCard, { opacity, transform: [{ scale }] }]}>
      {numericValue !== undefined ? (
        <AnimatedNumber value={numericValue} style={styles.statValue} suffix={suffix} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Comparison Badge ───────────────────────────────────

interface ComparisonBadgeProps {
  label: string;
  changePercent: number;
}

function ComparisonBadge({ label, changePercent }: ComparisonBadgeProps) {
  const isPositive = changePercent > 0;
  const isNeutral = changePercent === 0;
  const sign = isPositive ? '+' : '';
  const badgeStyle = isNeutral
    ? styles.badgeNeutral
    : isPositive
      ? styles.badgeUp
      : styles.badgeDown;
  const textStyle = isNeutral
    ? styles.badgeTextNeutral
    : isPositive
      ? styles.badgeTextUp
      : styles.badgeTextDown;

  return (
    <View style={[styles.comparisonBadge, badgeStyle]}>
      <Text style={textStyle}>
        {label} {sign}
        {Math.round(changePercent)}%
      </Text>
    </View>
  );
}

// ─── Workout Share Section (DOC_05 §8) ──────────────────

type SharePhase =
  | 'loading'          // resolving member/gym + today's share status
  | 'hidden'           // no member context or user skipped
  | 'ready'            // opt-in CTA visible
  | 'sharing'          // insert in flight
  | 'shared'           // success state
  | 'already_shared'   // one share per day already used
  | 'unavailable';     // RLS denied / network — friendly degradation

interface WorkoutShareSectionProps {
  volumeKg: number;
  prsHit: number;
  machinesUsed: string[];
}

function WorkoutShareSection({ volumeKg, prsHit, machinesUsed }: WorkoutShareSectionProps) {
  const [phase, setPhase] = useState<SharePhase>('loading');
  const [ctx, setCtx] = useState<FeedContext | null>(null);

  // Built once from session results — mirrors the web producer contract, so
  // the preview shows exactly what the feed will render.
  const share = useMemo(
    () => buildWorkoutShare({ volumeKg, prsHit, machinesUsed }),
    [volumeKg, prsHit, machinesUsed],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const feedCtx = await fetchFeedContext();
        if (cancelled) return;
        if (!feedCtx || feedCtx === 'signed-out') {
          setPhase('hidden');
          return;
        }
        setCtx(feedCtx);
        const already = await hasSharedToday(feedCtx.memberId, shareDateUtc());
        if (!cancelled) setPhase(already ? 'already_shared' : 'ready');
      } catch {
        if (!cancelled) setPhase('hidden');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShare = useCallback(async () => {
    if (!ctx) return;
    setPhase('sharing');
    try {
      const result: ShareWorkoutResult = await shareWorkoutToFeed({
        memberId: ctx.memberId,
        gymId: ctx.gymId,
        displayText: share.display_text,
        contextData: share.context_data as unknown as Record<string, unknown>,
        sharedAt: shareDateUtc(),
      });
      setPhase(result);
      if (result === 'shared') {
        trackEvent('workout_shared', { session_date: localSessionDate() });
      }
    } catch {
      // RLS-denied resolves to 'unavailable' inside the service; anything
      // else (network, etc.) lands here. Never crash the celebration screen.
      setPhase('unavailable');
    }
  }, [ctx, share]);

  if (phase === 'loading' || phase === 'hidden') return null;

  if (phase === 'shared') {
    return (
      <View style={[styles.shareStatusCard, styles.shareStatusSuccess]}>
        <Text style={styles.shareStatusIcon}>{'✓'}</Text>
        <Text style={styles.shareStatusTitle}>Shared to gym feed</Text>
      </View>
    );
  }

  if (phase === 'already_shared') {
    return (
      <View style={styles.shareStatusCard}>
        <Text style={styles.shareStatusTitle}>Already shared today</Text>
        <Text style={styles.shareStatusSub}>One share per day — see you tomorrow.</Text>
      </View>
    );
  }

  if (phase === 'unavailable') {
    return (
      <View style={styles.shareStatusCard}>
        <Text style={styles.shareStatusTitle}>Sharing isn&apos;t available right now</Text>
        <Text style={styles.shareStatusSub}>
          Your workout is saved — try sharing from the feed later.
        </Text>
      </View>
    );
  }

  // 'ready' | 'sharing' — opt-in CTA with a preview of the exact post
  return (
    <View style={styles.shareSection}>
      <Text style={styles.shareTitle}>Share with your gym?</Text>

      <View style={styles.sharePreviewBox}>
        <Text style={styles.sharePreviewText}>You {share.display_text}</Text>
        <Text style={styles.sharePreviewMeta}>
          {ctx?.gymName ? `Posts to the ${ctx.gymName} feed` : 'Posts to your gym feed'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.shareButton, phase === 'sharing' && styles.shareButtonDisabled]}
        onPress={handleShare}
        disabled={phase === 'sharing'}
        accessibilityRole="button"
        accessibilityLabel="Share workout to gym feed"
      >
        {phase === 'sharing' ? (
          <ActivityIndicator size="small" color={colors.primaryLight} />
        ) : (
          <Text style={styles.shareButtonText}>Share to Feed</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.shareSkipButton}
        onPress={() => setPhase('hidden')}
        disabled={phase === 'sharing'}
        accessibilityRole="button"
        accessibilityLabel="Skip sharing"
      >
        <Text style={styles.shareSkipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── PR label helpers ───────────────────────────────────

function prLabel(pr: PrResult, unit: WeightUnit): { type: string; text: string } {
  switch (pr.type) {
    case 'first_session':
      return { type: 'First', text: 'First session — baseline set' };
    case 'weight':
      return {
        type: 'Weight',
        text: `${formatWeightLbs(pr.value, unit)}${
          pr.improvementPct != null ? ` (+${pr.improvementPct}%)` : ''
        }`,
      };
    case 'volume':
      return {
        type: 'Volume',
        text: `${formatVolumeLbs(pr.value, unit)}${
          pr.improvementPct != null ? ` (+${pr.improvementPct}%)` : ''
        }`,
      };
    default:
      return { type: 'PR', text: 'New personal record' };
  }
}

// ─── Time of Day Label ──────────────────────────────────

function getTimeOfDayLabel(finishedAt: string | null): { label: string; emoji: string } {
  if (!finishedAt) return { label: 'Completed', emoji: '✓' };
  const hour = new Date(finishedAt).getHours();
  if (hour >= 5 && hour < 12) return { label: 'Morning Warrior', emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon Grinder', emoji: '☀️' };
  if (hour >= 17 && hour < 21) return { label: 'Evening Champion', emoji: '🌙' };
  return { label: 'Night Owl', emoji: '🦉' };
}

// ─── Intensity Level ────────────────────────────────────

function getIntensityLevel(volumeKg: number, durationMin: number): { level: string; color: string; ratio: number } {
  if (durationMin <= 0) return { level: 'N/A', color: colors.textSecondary, ratio: 0 };
  const vpm = volumeKg / durationMin;
  if (vpm < 20) return { level: 'Light', color: colors.success, ratio: 0.25 };
  if (vpm < 50) return { level: 'Moderate', color: colors.gold, ratio: 0.5 };
  if (vpm < 100) return { level: 'High', color: colors.amber, ratio: 0.75 };
  return { level: 'Beast Mode', color: colors.error, ratio: 1.0 };
}

// ─── Local insight line from the day-over-day delta ─────

function buildInsightLine(comparison: DayComparison | null): string | null {
  if (!comparison || comparison.volumeChangePct == null) return null;
  const v = comparison.volumeChangePct;
  if (v >= 10) return `Volume up ${Math.round(v)}% on your last workout — strong session.`;
  if (v > 0) return `A touch more volume than last time (+${Math.round(v)}%). Steady progress.`;
  if (v === 0) return 'Matched your last workout\'s volume. Consistency counts.';
  if (v > -15) return 'A lighter day than last time — recovery sessions build long-term strength.';
  return 'Much lighter than your last workout. Listen to your body and come back strong.';
}

// ─── Motivational Messages ──────────────────────────────

const MOTIVATIONAL_MESSAGES = [
  'Every rep counts. You showed up and that matters.',
  'Consistency beats perfection. Great work today.',
  'Stronger than yesterday, building for tomorrow.',
  'The only bad workout is the one that didn\'t happen.',
  'Progress is progress, no matter how small.',
  'Your future self will thank you for today.',
  'Discipline is choosing what you want most over what you want now.',
];

// ─── Main Screen ────────────────────────────────────────

export default function WorkoutCompleteScreen() {
  // Route param ([id]) is a token ('today') — the screen always summarizes
  // today's completed sessions for the signed-in member.
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lbs');
  const [rows, setRows] = useState<CompletedSessionRow[]>([]);
  const [machineNames, setMachineNames] = useState<Map<string, string>>(new Map());
  const [results, setResults] = useState<CompleteSessionResult[]>([]);
  const [sessionPrs, setSessionPrs] = useState<PrResult[]>([]);
  const [workoutNumber, setWorkoutNumber] = useState<number | null>(null);
  const [comparison, setComparison] = useState<DayComparison | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<ServerAchievement[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Handoff from the logger screen (single consume — survives re-renders
    // via state, but a cold open just renders the queried rows).
    const stashedResults = consumeCompletionResults();
    const stashedPrs = consumePrResults();
    if (stashedResults) {
      setResults(stashedResults);
      const seen = new Set<string>();
      const achievements: ServerAchievement[] = [];
      for (const r of stashedResults) {
        for (const a of r.new_achievements ?? []) {
          if (!seen.has(a.code)) {
            seen.add(a.code);
            achievements.push(a);
          }
        }
      }
      setUnlockQueue(achievements);
    }
    if (stashedPrs.length > 0) setSessionPrs(stashedPrs);

    try {
      const [ident, unit] = await Promise.all([
        resolveWorkoutIdentity(),
        getWeightUnit(),
      ]);
      setWeightUnitState(unit);
      if (!ident) {
        setError('Please sign in to view your workout summary.');
        return;
      }

      const today = localSessionDate();
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select(
          'id, machine_id, sets, sets_count, total_volume_lbs, best_weight_lbs, ' +
            'is_personal_best, completed_at, session_date',
        )
        .eq('member_id', ident.memberId)
        .eq('session_date', today)
        .not('completed_at', 'is', null);

      if (sessionError) throw sessionError;
      const todayRows = (sessionData ?? []) as unknown as CompletedSessionRow[];
      setRows(todayRows);

      // Machine names for the share section / PR list
      const machineIds = [...new Set(todayRows.map((r) => r.machine_id))];
      if (machineIds.length > 0) {
        const { data: machineData } = await supabase
          .from('machines')
          .select('id, name')
          .in('id', machineIds);
        setMachineNames(
          new Map(((machineData ?? []) as Array<{ id: string; name: string }>)
            .map((m) => [m.id, m.name])),
        );
      }

      // Workout number = count of distinct completed session dates
      try {
        const { data: dateData } = await supabase
          .from('workout_sessions')
          .select('session_date')
          .eq('member_id', ident.memberId)
          .not('completed_at', 'is', null);
        if (dateData) {
          const distinct = new Set(
            (dateData as Array<{ session_date: string }>).map((d) => d.session_date),
          );
          setWorkoutNumber(distinct.size);
        }
      } catch {
        // Non-critical
      }

      // Previous-workout comparison: most recent prior day with completed sessions
      try {
        const { data: prevData } = await supabase
          .from('workout_sessions')
          .select('session_date, sets, sets_count, total_volume_lbs, best_weight_lbs')
          .eq('member_id', ident.memberId)
          .lt('session_date', today)
          .not('completed_at', 'is', null)
          .order('session_date', { ascending: false })
          .limit(50);

        const prevRows = (prevData ?? []) as Array<{
          session_date: string;
          sets: SessionSetEntry[] | null;
          sets_count: number | null;
          total_volume_lbs: number | null;
          best_weight_lbs: number | null;
        }>;

        if (prevRows.length > 0 && todayRows.length > 0) {
          const prevDate = prevRows[0].session_date;
          const prevDay = aggregateDay(prevRows.filter((r) => r.session_date === prevDate));
          const todayAgg = aggregateDay(todayRows);

          setComparison({
            volumeChangePct:
              prevDay.volumeLbs > 0
                ? ((todayAgg.volumeLbs - prevDay.volumeLbs) / prevDay.volumeLbs) * 100
                : null,
            setsChangePct:
              prevDay.sets > 0
                ? ((todayAgg.sets - prevDay.sets) / prevDay.sets) * 100
                : null,
          });
        }
      } catch {
        // Non-critical
      }

      trackEvent('ai_summary_viewed', { session_date: today });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workout summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derived summary (from server rows + results) ──────
  const summary = useMemo(() => {
    const allSets = rows.flatMap((r) => r.sets ?? []);
    const totalSets = rows.reduce((sum, r) => sum + (r.sets_count ?? r.sets?.length ?? 0), 0);
    const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
    const totalVolumeLbs = rows.reduce((sum, r) => sum + (r.total_volume_lbs ?? 0), 0);
    const bestWeightLbs = rows.reduce(
      (max, r) => Math.max(max, r.best_weight_lbs ?? 0),
      0,
    );

    const loggedTimes = allSets
      .map((s) => new Date(s.logged_at).getTime())
      .filter((t) => !Number.isNaN(t));
    const completedTimes = rows
      .map((r) => (r.completed_at ? new Date(r.completed_at).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));
    const start = loggedTimes.length > 0 ? Math.min(...loggedTimes) : null;
    const end = completedTimes.length > 0 ? Math.max(...completedTimes) : null;
    const durationMinutes =
      start != null && end != null ? Math.max(0, (end - start) / (1000 * 60)) : 0;

    const latestCompletedAt =
      completedTimes.length > 0 ? new Date(Math.max(...completedTimes)).toISOString() : null;

    return {
      machines: rows.length,
      totalSets,
      totalReps,
      totalVolumeLbs,
      bestWeightLbs,
      durationMinutes,
      latestCompletedAt,
    };
  }, [rows]);

  const totalPoints = results.reduce((sum, r) => sum + (r.summary?.points_awarded ?? 0), 0);
  const streak = results.reduce((max, r) => Math.max(max, r.summary?.streak ?? 0), 0);
  const levelUp = results.find((r) => r.leveled_up && r.new_level)?.new_level ?? null;
  const achievements = useMemo(() => {
    const seen = new Set<string>();
    const list: ServerAchievement[] = [];
    for (const r of results) {
      for (const a of r.new_achievements ?? []) {
        if (!seen.has(a.code)) {
          seen.add(a.code);
          list.push(a);
        }
      }
    }
    return list;
  }, [results]);

  const prMachineNames = rows
    .filter((r) => r.is_personal_best)
    .map((r) => machineNames.get(r.machine_id) ?? 'Machine');
  const prsHit = Math.max(prMachineNames.length, sessionPrs.length);
  const machinesUsed = rows.map((r) => machineNames.get(r.machine_id) ?? 'Machine');
  const insightLine = buildInsightLine(comparison);
  const volumeKg = convertFromLbs(summary.totalVolumeLbs, 'kg');

  // ─── Render: Loading ────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  // ─── Render: Error / empty ──────────────────────────
  if (error || rows.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>
          {error ? 'Something went wrong' : 'No completed sessions today'}
        </Text>
        <Text style={styles.errorText}>
          {error || 'Finish a workout to see your summary here.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchData}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)' as const)}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text style={styles.homeButtonOutlineText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timeOfDay = getTimeOfDayLabel(summary.latestCompletedAt);
  const intensity = getIntensityLevel(volumeKg, summary.durationMinutes);

  // ─── Render: Summary ───────────────────────────────
  return (
    <AnimatedScreen>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Checkmark Circle */}
      <View style={styles.checkCircle}>
        <Text style={styles.checkText}>{'✓'}</Text>
      </View>

      <Text style={styles.heading}>Session Complete {'🎉'}</Text>

      {/* Time of Day Badge */}
      <View style={styles.timeOfDayBadge}>
        <Text style={styles.timeOfDayEmoji}>{timeOfDay.emoji}</Text>
        <Text style={styles.timeOfDayText}>{timeOfDay.label}</Text>
      </View>

      {/* Workout Number */}
      {workoutNumber !== null && (
        <View style={styles.workoutNumberBadge}>
          <Text style={styles.workoutNumberText}>
            Workout #{workoutNumber}
          </Text>
        </View>
      )}

      {/* ─── Server-awarded points + streak ──────────── */}
      {(totalPoints > 0 || streak > 0) && (
        <View style={styles.awardsRow}>
          {totalPoints > 0 && (
            <View style={styles.awardChip}>
              <Text style={styles.awardValue}>+{totalPoints}</Text>
              <Text style={styles.awardLabel}>points</Text>
            </View>
          )}
          {streak > 0 && (
            <View style={styles.awardChip}>
              <Text style={styles.awardValue}>{streak}</Text>
              <Text style={styles.awardLabel}>day streak</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── Level Up ────────────────────────────────── */}
      {levelUp && (
        <View style={styles.levelUpCard}>
          <Text style={styles.levelUpTitle}>Level Up!</Text>
          <Text style={styles.levelUpName}>
            Level {levelUp.level} — {levelUp.name}
          </Text>
        </View>
      )}

      {/* 2x2 Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Machines"
          value={summary.machines.toString()}
          numericValue={summary.machines}
          index={0}
        />
        <StatCard
          label="Sets"
          value={summary.totalSets.toString()}
          numericValue={summary.totalSets}
          index={1}
        />
        <StatCard
          label="Reps"
          value={summary.totalReps.toString()}
          numericValue={summary.totalReps}
          index={2}
        />
        <StatCard
          label="Volume"
          value={formatVolumeLbs(summary.totalVolumeLbs, weightUnit)}
          index={3}
        />
      </View>

      {/* Best Weight */}
      {summary.bestWeightLbs > 0 && (
        <View style={styles.durationContainer}>
          <Text style={styles.durationLabel}>Best Weight</Text>
          <Text style={styles.durationValue}>
            {formatWeightLbs(summary.bestWeightLbs, weightUnit)}
          </Text>
        </View>
      )}

      {/* Duration */}
      {summary.durationMinutes > 0 && (
        <View style={styles.durationContainer}>
          <Text style={styles.durationLabel}>Duration</Text>
          <Text style={styles.durationValue}>
            {formatDuration(summary.durationMinutes)}
          </Text>
        </View>
      )}

      {/* Intensity Meter */}
      {summary.durationMinutes > 0 && (
        <View style={styles.intensityContainer}>
          <View style={styles.intensityHeader}>
            <Text style={styles.intensityLabel}>Intensity</Text>
            <Text style={[styles.intensityLevel, { color: intensity.color }]}>
              {intensity.level}
            </Text>
          </View>
          <View style={styles.intensityBarBg}>
            <View style={[
              styles.intensityBarFill,
              {
                width: `${intensity.ratio * 100}%` as unknown as number,
                backgroundColor: intensity.color,
              },
            ]} />
          </View>
        </View>
      )}

      {/* ─── PR Section ──────────────────────────────── */}
      {(prMachineNames.length > 0 || sessionPrs.length > 0) && (
        <View style={styles.prContainer}>
          <View style={styles.prHeader}>
            <Text style={styles.prTrophy}>{'🏆'}</Text>
            <Text style={styles.prTitle}>Personal Records!</Text>
          </View>
          {sessionPrs.map((pr, index) => {
            const label = prLabel(pr, weightUnit);
            return (
              <View key={`pr-${index}`} style={styles.prRow}>
                <View style={styles.prTypeBadge}>
                  <Text style={styles.prTypeText}>{label.type}</Text>
                </View>
                <Text style={styles.prValue}>{label.text}</Text>
              </View>
            );
          })}
          {sessionPrs.length === 0 &&
            prMachineNames.map((name, index) => (
              <View key={`prm-${index}`} style={styles.prRow}>
                <View style={styles.prTypeBadge}>
                  <Text style={styles.prTypeText}>PR</Text>
                </View>
                <Text style={styles.prExercise}>{name}</Text>
              </View>
            ))}
        </View>
      )}

      {/* Volume / Sets Change Comparison Badges */}
      {comparison &&
        (comparison.volumeChangePct != null || comparison.setsChangePct != null) && (
          <View style={styles.comparisonRow}>
            {comparison.volumeChangePct != null && (
              <ComparisonBadge label="Volume" changePercent={comparison.volumeChangePct} />
            )}
            {comparison.setsChangePct != null && (
              <ComparisonBadge label="Sets" changePercent={comparison.setsChangePct} />
            )}
          </View>
        )}

      {/* Insight Line */}
      {insightLine && (
        <View style={styles.insightCard}>
          <Text style={styles.insightCardText}>{insightLine}</Text>
        </View>
      )}

      {/* ─── New Achievements (server-awarded) ───────── */}
      {achievements.length > 0 && (
        <View style={styles.badgeUnlockSection}>
          <Text style={styles.badgeUnlockTitle}>Achievement Unlocked!</Text>
          {achievements.map((a) => (
            <View key={a.code} style={styles.badgeUnlockCard}>
              <Text style={styles.badgeUnlockName}>{a.title}</Text>
              <Text style={styles.badgeUnlockPoints}>+{a.points} pts</Text>
            </View>
          ))}
        </View>
      )}

      {/* Share to gym feed (DOC_05 §8) */}
      <WorkoutShareSection
        volumeKg={volumeKg}
        prsHit={prsHit}
        machinesUsed={machinesUsed}
      />

      {/* Motivational Closer */}
      <View style={styles.motivationalContainer}>
        <Text style={styles.motivationalText}>
          {MOTIVATIONAL_MESSAGES[
            localSessionDate().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
              MOTIVATIONAL_MESSAGES.length
          ]}
        </Text>
      </View>

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.backToHomeButton}
        onPress={() => router.replace('/(tabs)' as const)}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
      >
        <Text style={styles.backToHomeText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>

    {/* Achievement unlock takeover — one celebration per new achievement.
        The server payload is {code, title, points}; superset literal keeps
        the call site compatible with the AchievementUnlock contract. */}
    {unlockQueue.length > 0 && (
      <AchievementUnlock
        achievement={{
          id: unlockQueue[0].code,
          title: unlockQueue[0].title,
          name: unlockQueue[0].title,
          description: `+${unlockQueue[0].points} points earned`,
          icon: '🏆',
          points: unlockQueue[0].points,
          rarity: 'common',
        } as unknown as UnlockedAchievement}
        onDismiss={() => setUnlockQueue((q) => q.slice(1))}
      />
    )}
    </AnimatedScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },

  // Loading / Error
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.error,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 48,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    overflow: 'hidden',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  homeButtonOutlineText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Checkmark — crimson ring, tonal (no green block)
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  checkText: {
    fontSize: 40,
    color: colors.primaryLight,
    fontWeight: '700',
    lineHeight: 44,
  },

  // Heading — serif editorial (Stitch session-summary)
  heading: {
    fontSize: 32,
    fontFamily: typography.fontSerifBold,
    color: colors.text,
    marginBottom: 28,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Awards row (server-derived points + streak)
  awardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  awardChip: {
    flex: 1,
    backgroundColor: colors.goldSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '59',
    padding: 14,
    alignItems: 'center',
  },
  awardValue: {
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
    marginBottom: 2,
  },
  awardLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Level-up card
  levelUpCard: {
    width: '100%',
    backgroundColor: colors.primarySubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  levelUpTitle: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  levelUpName: {
    fontSize: 18,
    fontFamily: typography.fontSerifBold,
    color: colors.text,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  statCard: {
    width: '46%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Duration / Best weight
  durationContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    width: '100%',
  },
  durationLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  durationValue: {
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },

  // PR Callout — gold metallic treatment (Stitch session-summary)
  prContainer: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gold + '59',
    marginBottom: 16,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prTrophy: {
    fontSize: 20,
    marginRight: 8,
  },
  prTitle: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.goldSubtle,
  },
  prTypeBadge: {
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.gold + '59',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  prTypeText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prExercise: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  prValue: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
  },

  // Comparison Badges
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  comparisonBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeUp: {
    backgroundColor: colors.successSubtle,
  },
  badgeDown: {
    backgroundColor: colors.errorSubtle,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceElevated,
  },
  badgeTextUp: {
    fontSize: 13,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.success,
  },
  badgeTextDown: {
    fontSize: 13,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.error,
  },
  badgeTextNeutral: {
    fontSize: 13,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },

  // Insight Card
  insightCard: {
    width: '100%',
    backgroundColor: colors.primarySubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: 16,
    marginBottom: 16,
  },
  insightCardText: {
    fontSize: 15,
    fontFamily: typography.fontMedium,
    color: colors.text,
    lineHeight: 22,
  },

  // Back to Home — primary CTA, solid crimson + glow
  backToHomeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  backToHomeText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontFamily: typography.fontBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Achievement unlock styles
  badgeUnlockSection: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  badgeUnlockTitle: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeUnlockCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gold + '59',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  badgeUnlockName: {
    fontSize: 16,
    fontFamily: typography.fontSerif,
    color: colors.text,
  },
  badgeUnlockPoints: {
    fontSize: 12,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
    marginTop: 4,
  },

  // Time of Day Badge
  timeOfDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 6,
  },
  timeOfDayEmoji: {
    fontSize: 18,
  },
  timeOfDayText: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
  },

  // Workout Number
  workoutNumberBadge: {
    marginBottom: 20,
  },
  workoutNumberText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Intensity Meter
  intensityContainer: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  intensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  intensityLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  intensityLevel: {
    fontSize: 13,
    fontFamily: typography.fontBold,
  },
  intensityBarBg: {
    height: 8,
    backgroundColor: colors.bgSkeleton,
    borderRadius: 4,
    overflow: 'hidden',
  },
  intensityBarFill: {
    height: 8,
    borderRadius: 4,
  },

  // Workout Share Section (DOC_05 §8) — secondary ghost-crimson CTA
  shareSection: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 16,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: 12,
  },
  sharePreviewBox: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: 12,
    marginBottom: 14,
  },
  sharePreviewText: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    lineHeight: 20,
  },
  sharePreviewMeta: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontFamily: typography.fontBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  shareSkipButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  shareSkipText: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  shareStatusCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  shareStatusSuccess: {
    backgroundColor: colors.successSubtle,
    borderColor: colors.success,
  },
  shareStatusIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  shareStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  shareStatusSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Motivational Closer
  motivationalContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  motivationalText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
