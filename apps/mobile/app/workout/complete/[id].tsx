import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { calculateVolume, formatDuration, formatWeight } from '@smartgym/utils';
import { getWorkoutInsight } from '@smartgym/ai-assist';
import type {
  Workout,
  WorkoutExerciseWithSets,
  WorkoutSummary,
  WorkoutInsight,
  PRDetection,
  WorkoutSet,
} from '@smartgym/types';
import { trackEvent } from '../../../src/lib/events';
import {
  isFeatureEnabled,
  refreshFeatureFlags,
  needsRefresh,
} from '../../../src/lib/featureFlags';
import { awardPoints } from '../../../src/lib/pointsService';

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
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

// ─── Main Screen ────────────────────────────────────────

export default function WorkoutCompleteScreen() {
  const { id: workoutId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<WorkoutInsight | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);

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
            .single();

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
        } catch {
          // AI insight is non-critical; silently swallow errors
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
        <ActivityIndicator size="large" color="#4361ee" />
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
          onPress={() => router.replace('/(tabs)/')}
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Checkmark Circle */}
      <View style={styles.checkCircle}>
        <Text style={styles.checkText}>{'\u2713'}</Text>
      </View>

      <Text style={styles.heading}>Workout Complete!</Text>

      {/* 2x2 Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Exercises"
          value={summary.total_exercises.toString()}
        />
        <StatCard
          label="Sets"
          value={summary.total_sets.toString()}
        />
        <StatCard
          label="Reps"
          value={summary.total_reps.toString()}
        />
        <StatCard
          label="Volume"
          value={formatWeight(summary.total_volume_kg)}
        />
      </View>

      {/* Duration */}
      <View style={styles.durationContainer}>
        <Text style={styles.durationLabel}>Duration</Text>
        <Text style={styles.durationValue}>
          {formatDuration(summary.duration_minutes)}
        </Text>
      </View>

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

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.backToHomeButton}
        onPress={() => router.replace('/(tabs)/')}
      >
        <Text style={styles.backToHomeText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#f8f9fa',
  },

  // Loading / Error
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e63946',
    color: '#ffffff',
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
    color: '#1a1a2e',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  homeButtonOutlineText: {
    color: '#4361ee',
    fontSize: 16,
    fontWeight: '600',
  },

  // Checkmark
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a9d8f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkText: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: '700',
    lineHeight: 44,
  },

  // Heading
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3a0ca3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
  },

  // Duration
  durationContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 32,
    width: '100%',
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  durationValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
  },

  // ─── Phase 2.5: AI Insight Styles ───────────────────

  insightSection: {
    width: '100%',
    marginBottom: 24,
    gap: 16,
  },

  // PR Callout
  prContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#ffd700',
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
    color: '#b8860b',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#fff3cd',
  },
  prTypeBadge: {
    backgroundColor: '#ffd700',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  prTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5c4813',
  },
  prExercise: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  prValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b8860b',
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
    backgroundColor: '#d4edda',
  },
  badgeDown: {
    backgroundColor: '#f8d7da',
  },
  badgeNeutral: {
    backgroundColor: '#e2e3e5',
  },
  badgeTextUp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#155724',
  },
  badgeTextDown: {
    fontSize: 14,
    fontWeight: '700',
    color: '#721c24',
  },
  badgeTextNeutral: {
    fontSize: 14,
    fontWeight: '700',
    color: '#383d41',
  },

  // Top Exercises
  topExercisesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  topExercisesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  topExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
  },
  topExerciseRank: {
    width: 24,
    fontSize: 16,
    fontWeight: '700',
    color: '#3a0ca3',
  },
  topExerciseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  topExerciseVolume: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6c757d',
  },

  // Insight Card
  insightCard: {
    backgroundColor: '#edf2ff',
    borderRadius: 12,
    padding: 16,
  },
  insightCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a2e',
    lineHeight: 22,
  },

  // Next Time Suggestion
  nextTimeSuggestion: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  nextTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nextTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a2e',
    lineHeight: 22,
  },

  // Back to Home
  backToHomeButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  backToHomeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
