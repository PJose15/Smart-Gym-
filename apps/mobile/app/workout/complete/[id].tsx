import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { calculateVolume, formatDuration, formatWeight } from '@nexera/utils';
import { getWorkoutInsight, computeGuardrails, getCoachingInsight, buildMemberContext } from '@nexera/ai-assist';
import type { WorkoutRecord, CoachingInsight } from '@nexera/ai-assist';
import { fetchCoachingInsight } from '../../../src/lib/aiService';
import type {
  Workout,
  WorkoutExerciseWithSets,
  WorkoutSummary,
  WorkoutInsight,
  PRDetection,
  WorkoutSet,
  GuardrailInsight,
  ExperienceLevel,
} from '@nexera/types';
import { trackEvent } from '../../../src/lib/events';
import {
  isFeatureEnabled,
  refreshFeatureFlags,
  needsRefresh,
} from '../../../src/lib/featureFlags';
import { awardPoints } from '../../../src/lib/pointsService';
import { checkAndAwardStreakBonus } from '../../../src/lib/streakService';
import { checkAndUnlockBadges } from '../../../src/lib/badgeService';
import { sendLocalNotification } from '../../../src/lib/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnimatedScreen } from '../../../src/components/AnimatedScreen';
import { AnimatedNumber } from '../../../src/components/AnimatedNumber';
import { colors } from '../../../src/theme/colors';

function computeSummary(
  workout: Workout,
  exercises: WorkoutExerciseWithSets[],
): WorkoutSummary {
  const allSets = exercises.flatMap((e) => e.sets);

  const totalExercises = exercises.length;
  const totalSets = allSets.length;
  const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
  const totalVolumeKg = calculateVolume(allSets);

  let durationMinutes = 0;
  if (workout.finished_at && workout.started_at) {
    const start = new Date(workout.started_at).getTime();
    const end = new Date(workout.finished_at).getTime();
    durationMinutes = Math.max(0, (end - start) / (1000 * 60));
  }

  return {
    workout_id: workout.id,
    total_exercises: totalExercises,
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume_kg: totalVolumeKg,
    duration_minutes: durationMinutes,
  };
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

// ─── PR Label Mapping ───────────────────────────────────

function prTypeLabel(type: PRDetection['type']): string {
  switch (type) {
    case 'PR_WEIGHT':
      return 'Weight';
    case 'PR_REPS':
      return 'Reps';
    case 'PR_EST_1RM':
      return 'Est 1RM';
    default:
      return type;
  }
}

// ─── Time of Day Label ──────────────────────────────────

function getTimeOfDayLabel(finishedAt: string | null): { label: string; emoji: string } {
  if (!finishedAt) return { label: 'Completed', emoji: '\u2713' };
  const hour = new Date(finishedAt).getHours();
  if (hour >= 5 && hour < 12) return { label: 'Morning Warrior', emoji: '\uD83C\uDF05' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon Grinder', emoji: '\u2600\uFE0F' };
  if (hour >= 17 && hour < 21) return { label: 'Evening Champion', emoji: '\uD83C\uDF19' };
  return { label: 'Night Owl', emoji: '\uD83E\uDD89' };
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
  const { id: workoutId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<WorkoutInsight | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [guardrails, setGuardrails] = useState<GuardrailInsight[]>([]);
  const [coachingInsight, setCoachingInsight] = useState<CoachingInsight | null>(null);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
  const [workoutNumber, setWorkoutNumber] = useState<number | null>(null);
  const [workoutFinishedAt, setWorkoutFinishedAt] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!workoutId) {
      setError('No workout ID provided');
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);

    setLoading(true);
    setError(null);

    try {
      // Fetch workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .abortSignal(controller.signal)
        .single();

      if (workoutError) throw workoutError;
      if (!workoutData) throw new Error('Workout not found');

      const workout = workoutData as Workout;

      // Fetch exercises with sets
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*, sets(*)')
        .eq('workout_id', workoutId)
        .order('order_index')
        .abortSignal(controller.signal);

      if (exercisesError) throw exercisesError;

      const exercises = (exercisesData ?? []) as WorkoutExerciseWithSets[];
      setSummary(computeSummary(workout, exercises));
      setWorkoutFinishedAt(workout.finished_at ?? null);

      // Fetch total completed workout count for this user
      try {
        const { count } = await supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', workout.profile_id)
          .eq('status', 'completed');
        if (count !== null) setWorkoutNumber(count);
      } catch {
        // Non-critical
      }

      // Auto-award points for completing a workout
      try {
        await awardPoints({
          profileId: workout.profile_id,
          gymId: workout.gym_id,
          points: 50,
          reason: 'workout_completed',
          referenceId: workoutId,
        });
      } catch {
        // Non-fatal — points award failure shouldn't break the summary
      }

      // Award streak bonus if applicable
      try {
        const streakResult = await checkAndAwardStreakBonus(workout.profile_id, workout.gym_id);
        if (streakResult?.shouldAwardBonus && streakResult.bonusPoints > 0) {
          sendLocalNotification({
            type: 'streak_milestone',
            title: 'Streak Milestone!',
            body: `${streakResult.currentStreak}-week streak! +${streakResult.bonusPoints} bonus points`,
          });
        }
      } catch {
        // Non-fatal
      }

      // Check and unlock badges
      if (isFeatureEnabled('badges_enabled')) {
        try {
          const newSlugs = await checkAndUnlockBadges(workout.profile_id, workout.gym_id);
          if (newSlugs.length > 0) {
            setNewlyUnlockedBadges(newSlugs);
            sendLocalNotification({
              type: 'badge_unlocked',
              title: 'Badge Unlocked!',
              body:
                newSlugs.length === 1
                  ? `You earned: ${newSlugs[0].replace(/_/g, ' ')}`
                  : `You earned ${newSlugs.length} new badges!`,
            });
          }
        } catch {
          // Non-fatal
        }
      }

      // Track workout finished event
      trackEvent('workout_finished', { workout_id: workoutId });

      // ─── AI Insight: fetch previous workout + historical sets ───
      const aiFlag = isFeatureEnabled('ai_summary');
      if (aiFlag) {
        try {
          // Fetch previous completed workout for the same profile
          const { data: prevWorkoutData } = await supabase
            .from('workouts')
            .select('id')
            .eq('profile_id', workout.profile_id)
            .eq('status', 'completed')
            .neq('id', workoutId)
            .order('finished_at', { ascending: false })
            .limit(1)
            .abortSignal(controller.signal)
            .maybeSingle();

          let previousExercises: WorkoutExerciseWithSets[] = [];
          if (prevWorkoutData) {
            const { data: prevExData } = await supabase
              .from('workout_exercises')
              .select('*, sets(*)')
              .eq('workout_id', prevWorkoutData.id)
              .order('order_index')
              .abortSignal(controller.signal);

            previousExercises = (prevExData ?? []) as WorkoutExerciseWithSets[];
          }

          // Fetch historical sets per exercise_name for PR detection
          // Get all completed workout IDs for this user (excluding current)
          const { data: pastWorkoutIds } = await supabase
            .from('workouts')
            .select('id')
            .eq('profile_id', workout.profile_id)
            .eq('status', 'completed')
            .neq('id', workoutId)
            .abortSignal(controller.signal);

          const exerciseNames = exercises.map((e) => e.exercise_name);
          const pastIds = (pastWorkoutIds ?? []).map((w: { id: string }) => w.id);

          let historicalData: unknown[] = [];
          if (pastIds.length > 0 && exerciseNames.length > 0) {
            const { data: hData } = await supabase
              .from('workout_exercises')
              .select('exercise_name, sets(*)')
              .in('workout_id', pastIds)
              .in('exercise_name', exerciseNames)
              .abortSignal(controller.signal);
            historicalData = hData ?? [];
          }

          const historicalSets = new Map<string, WorkoutSet[]>();
          for (const entry of historicalData ?? []) {
            const typed = entry as WorkoutExerciseWithSets;
            const existing = historicalSets.get(typed.exercise_name) ?? [];
            existing.push(...typed.sets);
            historicalSets.set(typed.exercise_name, existing);
          }

          const result = getWorkoutInsight({
            currentExercises: exercises,
            previousExercises,
            historicalSets,
          });

          setInsight(result);
          trackEvent('ai_summary_viewed', { workout_id: workoutId });

          // Persist PRs for home screen celebration banner
          if (result.prs && result.prs.length > 0) {
            try {
              await AsyncStorage.setItem(
                '@nexera/unseen_prs',
                JSON.stringify(result.prs),
              );
            } catch (e) {
              console.warn('[complete] PR persist failed:', e);
            }
          }
        } catch {
          // AI insight is non-critical; silently swallow errors
        }
      }

      // ─── Phase 2.5.2: Guardrails on workout finish ──────
      if (isFeatureEnabled('ai_guardrails')) {
        try {
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentWorkoutsData } = await supabase
            .from('workouts')
            .select('id, started_at, finished_at')
            .eq('profile_id', workout.profile_id)
            .eq('status', 'completed')
            .gte('started_at', twoWeeksAgo)
            .order('started_at', { ascending: false })
            .abortSignal(controller.signal);

          if (recentWorkoutsData && recentWorkoutsData.length > 0) {
            const wIds = recentWorkoutsData.map((w: { id: string }) => w.id);
            const { data: recentExData } = await supabase
              .from('workout_exercises')
              .select('workout_id, exercise_name, machine_id, sets(*)')
              .in('workout_id', wIds)
              .abortSignal(controller.signal);

            const machineIds = [...new Set((recentExData ?? [])
              .map((e: { machine_id: string | null }) => e.machine_id)
              .filter(Boolean))] as string[];

            const machineMap = new Map<string, string[]>();
            if (machineIds.length > 0) {
              const { data: machData } = await supabase
                .from('machines')
                .select('id, primary_muscles')
                .in('id', machineIds)
                .abortSignal(controller.signal);
              for (const m of machData ?? []) {
                machineMap.set(m.id, m.primary_muscles ?? []);
              }
            }

            const records: WorkoutRecord[] = recentWorkoutsData.map((w: { id: string; started_at: string; finished_at: string | null }) => ({
              id: w.id,
              started_at: w.started_at,
              finished_at: w.finished_at,
              exercises: (recentExData ?? [])
                .filter((e: { workout_id: string }) => e.workout_id === w.id)
                .map((e: { exercise_name: string; machine_id: string | null; sets: WorkoutSet[] }) => ({
                  exercise_name: e.exercise_name,
                  machine_id: e.machine_id,
                  primary_muscles: e.machine_id ? machineMap.get(e.machine_id) : undefined,
                  sets: (e.sets ?? []) as WorkoutSet[],
                })),
            }));

            const { data: tp } = await supabase
              .from('user_training_profiles')
              .select('experience')
              .eq('profile_id', workout.profile_id)
              .maybeSingle();

            const grInsights = computeGuardrails({
              experience: (tp?.experience as ExperienceLevel) ?? 'intermediate',
              recentWorkouts: records,
            });

            setGuardrails(grInsights);
          }
        } catch {
          // Non-critical
        }
      }

      // ─── Phase 3: Post-workout coaching insight ───────
      if (isFeatureEnabled('ai_coaching')) {
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: cWorkouts } = await supabase
            .from('workouts')
            .select('id, started_at, finished_at')
            .eq('profile_id', workout.profile_id)
            .eq('status', 'completed')
            .gte('started_at', thirtyDaysAgo)
            .order('started_at', { ascending: false });

          const cIds = (cWorkouts ?? []).map((w: { id: string }) => w.id);
          let cMapped: Array<{
            id: string; started_at: string; finished_at: string | null;
            exercises: Array<{ exercise_name: string; sets: Array<{ weight_kg: number; reps: number }> }>;
          }> = [];

          if (cIds.length > 0) {
            const { data: cExData } = await supabase
              .from('workout_exercises')
              .select('workout_id, exercise_name, sets(*)')
              .in('workout_id', cIds);

            cMapped = (cWorkouts ?? []).map((w: { id: string; started_at: string; finished_at: string | null }) => ({
              id: w.id,
              started_at: w.started_at,
              finished_at: w.finished_at,
              exercises: (cExData ?? [])
                .filter((e: { workout_id: string }) => e.workout_id === w.id)
                .map((e: { exercise_name: string; sets: Array<{ weight_kg: number; reps: number }> }) => ({
                  exercise_name: e.exercise_name,
                  sets: (e.sets ?? []) as Array<{ weight_kg: number; reps: number }>,
                })),
            }));
          }

          const { data: allDates } = await supabase
            .from('workouts')
            .select('started_at')
            .eq('profile_id', workout.profile_id)
            .eq('status', 'completed');

          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', workout.profile_id)
            .maybeSingle();

          const coachingInput = {
            memberName: profileData?.full_name || 'there',
            workouts: cMapped,
            prs: (insight?.prs ?? []).map((p: PRDetection) => ({ exercise_name: p.exercise_name })),
            feedbackTrends: { discomfort_count: 0, unstable_count: 0, ok_count: 0 },
            completedWorkoutDates: (allDates ?? []).map((d: { started_at: string }) => d.started_at),
          };

          // Try AI via edge function, fall back to deterministic rules
          const ctx = buildMemberContext(coachingInput);
          const aiResult = await fetchCoachingInsight({
            memberName: coachingInput.memberName,
            contextSummary: ctx.summaryText,
            gaps: ctx.gaps,
            risks: ctx.risks,
            recentPRs: ctx.recentPRs,
          });

          if (aiResult.ok && aiResult.data.message && aiResult.data.message.length > 10) {
            setCoachingInsight({
              message: aiResult.data.message,
              action_items: aiResult.data.action_items,
              source: 'ai',
            });
          } else {
            const coaching = await getCoachingInsight(coachingInput);
            setCoachingInsight(coaching);
          }
        } catch {
          // Non-critical
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load workout summary');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [workoutId]);

  // Refresh feature flags on mount, then set aiEnabled
  useEffect(() => {
    let cancelled = false;

    async function initFlags() {
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }
      if (!cancelled) {
        setAiEnabled(isFeatureEnabled('ai_summary'));
      }
    }

    initFlags();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  // ─── Render: Loading ────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  // ─── Render: Error ──────────────────────────────────
  if (error || !summary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error || 'Could not load workout summary.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)' as const)}
        >
          <Text style={styles.homeButtonOutlineText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Helpers: top exercises by volume ───────────────
  const topExercises = insight?.top_exercises_by_volume?.slice(0, 3) ?? [];

  // ─── Render: Summary ───────────────────────────────
  return (
    <AnimatedScreen>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Checkmark Circle */}
      <View style={styles.checkCircle}>
        <Text style={styles.checkText}>{'\u2713'}</Text>
      </View>

      <Text style={styles.heading}>Workout Complete!</Text>

      {/* Time of Day Badge */}
      <View style={styles.timeOfDayBadge}>
        <Text style={styles.timeOfDayEmoji}>
          {getTimeOfDayLabel(workoutFinishedAt).emoji}
        </Text>
        <Text style={styles.timeOfDayText}>
          {getTimeOfDayLabel(workoutFinishedAt).label}
        </Text>
      </View>

      {/* Workout Number */}
      {workoutNumber !== null && (
        <View style={styles.workoutNumberBadge}>
          <Text style={styles.workoutNumberText}>
            Workout #{workoutNumber}
          </Text>
        </View>
      )}

      {/* 2x2 Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Exercises"
          value={summary.total_exercises.toString()}
          numericValue={summary.total_exercises}
          index={0}
        />
        <StatCard
          label="Sets"
          value={summary.total_sets.toString()}
          numericValue={summary.total_sets}
          index={1}
        />
        <StatCard
          label="Reps"
          value={summary.total_reps.toString()}
          numericValue={summary.total_reps}
          index={2}
        />
        <StatCard
          label="Volume"
          value={formatWeight(summary.total_volume_kg)}
          numericValue={Math.round(summary.total_volume_kg)}
          suffix=" kg"
          index={3}
        />
      </View>

      {/* Duration */}
      <View style={styles.durationContainer}>
        <Text style={styles.durationLabel}>Duration</Text>
        <Text style={styles.durationValue}>
          {formatDuration(summary.duration_minutes)}
        </Text>
      </View>

      {/* Intensity Meter */}
      {summary.duration_minutes > 0 && (
        <View style={styles.intensityContainer}>
          <View style={styles.intensityHeader}>
            <Text style={styles.intensityLabel}>Intensity</Text>
            <Text style={[styles.intensityLevel, { color: getIntensityLevel(summary.total_volume_kg, summary.duration_minutes).color }]}>
              {getIntensityLevel(summary.total_volume_kg, summary.duration_minutes).level}
            </Text>
          </View>
          <View style={styles.intensityBarBg}>
            <View style={[
              styles.intensityBarFill,
              {
                width: `${getIntensityLevel(summary.total_volume_kg, summary.duration_minutes).ratio * 100}%` as unknown as number,
                backgroundColor: getIntensityLevel(summary.total_volume_kg, summary.duration_minutes).color,
              },
            ]} />
          </View>
        </View>
      )}

      {/* Per-Exercise Averages */}
      {summary.total_exercises > 0 && (
        <View style={styles.averagesRow}>
          <View style={styles.averageChip}>
            <Text style={styles.averageValue}>
              {(summary.total_sets / summary.total_exercises).toFixed(1)}
            </Text>
            <Text style={styles.averageLabel}>sets/exercise</Text>
          </View>
          {summary.total_sets > 0 && (
            <View style={styles.averageChip}>
              <Text style={styles.averageValue}>
                {(summary.total_reps / summary.total_sets).toFixed(1)}
              </Text>
              <Text style={styles.averageLabel}>reps/set</Text>
            </View>
          )}
          {summary.total_sets > 0 && summary.total_volume_kg > 0 && (
            <View style={styles.averageChip}>
              <Text style={styles.averageValue}>
                {(summary.total_volume_kg / summary.total_sets).toFixed(1)}
              </Text>
              <Text style={styles.averageLabel}>kg/set</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── Phase 2.5: AI Insight Section (gated) ──────── */}
      {aiEnabled && insight && (
        <View style={styles.insightSection}>
          {/* PR Callouts */}
          {insight.prs && insight.prs.length > 0 && (
            <View style={styles.prContainer}>
              <View style={styles.prHeader}>
                <Text style={styles.prTrophy}>{'\uD83C\uDFC6'}</Text>
                <Text style={styles.prTitle}>Personal Records!</Text>
              </View>
              {insight.prs.map((pr: PRDetection, index: number) => (
                <View key={index} style={styles.prRow}>
                  <View style={styles.prTypeBadge}>
                    <Text style={styles.prTypeText}>
                      {prTypeLabel(pr.type)}
                    </Text>
                  </View>
                  <Text style={styles.prExercise}>{pr.exercise_name}</Text>
                  <Text style={styles.prValue}>{pr.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Volume / Reps Change Comparison Badges */}
          {(insight.volume_change != null ||
            insight.reps_change != null) && (
              <View style={styles.comparisonRow}>
                {insight.volume_change != null && (
                  <ComparisonBadge
                    label="Volume"
                    changePercent={insight.volume_change}
                  />
                )}
                {insight.reps_change != null && (
                  <ComparisonBadge
                    label="Reps"
                    changePercent={insight.reps_change}
                  />
                )}
              </View>
            )}

          {/* Top Exercises by Volume */}
          {topExercises.length > 0 && (
            <View style={styles.topExercisesContainer}>
              <Text style={styles.topExercisesTitle}>
                Top Exercises by Volume
              </Text>
              {topExercises.map(
                (
                  ex: { exercise_name: string; volume: number },
                  index: number,
                ) => (
                  <View key={index} style={styles.topExerciseRow}>
                    <Text style={styles.topExerciseRank}>{index + 1}</Text>
                    <Text style={styles.topExerciseName}>
                      {ex.exercise_name}
                    </Text>
                    <Text style={styles.topExerciseVolume}>
                      {formatWeight(ex.volume)}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* Insight Line */}
          {insight.insight_text ? (
            <View style={styles.insightCard}>
              <Text style={styles.insightCardText}>
                {insight.insight_text}
              </Text>
            </View>
          ) : null}

          {/* Next Time Suggestion */}
          {insight.next_time_suggestion ? (
            <View style={styles.nextTimeSuggestion}>
              <Text style={styles.nextTimeLabel}>Next Time</Text>
              <Text style={styles.nextTimeText}>
                {insight.next_time_suggestion}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Phase 2.5.2: Recovery Notes */}
      {guardrails.length > 0 && (
        <View style={styles.guardrailSection}>
          <Text style={styles.guardrailTitle}>Recovery Notes</Text>
          {guardrails.slice(0, 2).map((g, i) => (
            <View key={i} style={styles.guardrailCard}>
              <View style={[
                styles.guardrailSeverityBar,
                g.severity === 'high' ? { backgroundColor: colors.error }
                  : g.severity === 'medium' ? { backgroundColor: colors.amber }
                  : { backgroundColor: colors.success },
              ]} />
              <View style={styles.guardrailCardContent}>
                <Text style={styles.guardrailMessage}>{g.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Phase 3: Coaching Insight */}
      {coachingInsight && (
        <View style={styles.coachingSection}>
          <Text style={styles.coachingSectionTitle}>
            {coachingInsight.source === 'ai' ? 'AI Coach Says' : 'Coach Tip'}
          </Text>
          <Text style={styles.coachingSectionMessage}>
            {coachingInsight.message}
          </Text>
          {coachingInsight.action_items.length > 0 && (
            <View style={styles.coachingActionsList}>
              {coachingInsight.action_items.map((item, i) => (
                <View key={i} style={styles.coachingActionItem}>
                  <View style={styles.coachingDot} />
                  <Text style={styles.coachingActionItemText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Badge Unlocks */}
      {newlyUnlockedBadges.length > 0 && (
        <View style={styles.badgeUnlockSection}>
          <Text style={styles.badgeUnlockTitle}>Badge Unlocked!</Text>
          {newlyUnlockedBadges.map((slug) => (
            <View key={slug} style={styles.badgeUnlockCard}>
              <Text style={styles.badgeUnlockName}>{slug.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Motivational Closer */}
      <View style={styles.motivationalContainer}>
        <Text style={styles.motivationalText}>
          {MOTIVATIONAL_MESSAGES[
            (workoutId ?? '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % MOTIVATIONAL_MESSAGES.length
          ]}
        </Text>
      </View>

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.backToHomeButton}
        onPress={() => router.replace('/(tabs)' as const)}
      >
        <Text style={styles.backToHomeText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
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

  // Checkmark
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkText: {
    fontSize: 40,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 44,
  },

  // Heading
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 28,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  // Duration
  durationContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 32,
    width: '100%',
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  durationValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },

  // ─── Phase 2.5: AI Insight Styles ───────────────────

  insightSection: {
    width: '100%',
    marginBottom: 24,
    gap: 16,
  },

  // PR Callout
  prContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prTrophy: {
    fontSize: 24,
    marginRight: 8,
  },
  prTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.goldDark,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.goldSubtle,
  },
  prTypeBadge: {
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  prTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
  prExercise: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  prValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.goldDark,
  },

  // Comparison Badges
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  comparisonBadge: {
    borderRadius: 20,
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
    backgroundColor: colors.surfaceHighest,
  },
  badgeTextUp: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  badgeTextDown: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.error,
  },
  badgeTextNeutral: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  // Top Exercises
  topExercisesContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topExercisesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  topExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  topExerciseRank: {
    width: 24,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  topExerciseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  topExerciseVolume: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Insight Card
  insightCard: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    padding: 16,
  },
  insightCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },

  // Next Time Suggestion
  nextTimeSuggestion: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nextTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },

  // Guardrail styles
  guardrailSection: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  guardrailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.amber,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  guardrailCard: {
    flexDirection: 'row',
    backgroundColor: colors.goldSubtle,
    borderRadius: 12,
    overflow: 'hidden',
  },
  guardrailSeverityBar: {
    width: 4,
  },
  guardrailCardContent: {
    flex: 1,
    padding: 12,
  },
  guardrailMessage: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // Back to Home
  backToHomeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  backToHomeText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  // Phase 3: Coaching
  coachingSection: {
    width: '100%',
    backgroundColor: colors.primarySubtle,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachingSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  coachingSectionMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  coachingActionsList: {
    marginTop: 10,
    gap: 6,
  },
  coachingActionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  coachingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  coachingActionItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  // Badge unlock styles
  badgeUnlockSection: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  badgeUnlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.goldDark,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeUnlockCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  badgeUnlockName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },

  // Time of Day Badge
  timeOfDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 6,
  },
  timeOfDayEmoji: {
    fontSize: 18,
  },
  timeOfDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Workout Number
  workoutNumberBadge: {
    marginBottom: 20,
  },
  workoutNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Intensity Meter
  intensityContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  intensityLevel: {
    fontSize: 14,
    fontWeight: '700',
  },
  intensityBarBg: {
    height: 8,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 4,
    overflow: 'hidden',
  },
  intensityBarFill: {
    height: 8,
    borderRadius: 4,
  },

  // Per-Exercise Averages
  averagesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 24,
  },
  averageChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  averageValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  averageLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
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
