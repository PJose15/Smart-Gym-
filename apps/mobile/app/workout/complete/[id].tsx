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
import type {
  Workout,
  WorkoutExerciseWithSets,
  WorkoutSummary,
} from '@smartgym/types';

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

// ─── Main Screen ────────────────────────────────────────

export default function WorkoutCompleteScreen() {
  const { id: workoutId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
