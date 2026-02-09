import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { estimate1RM, calculateVolume, formatWeight } from '@smartgym/utils';
import type { WorkoutSet } from '@smartgym/types';

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

// ─── Component ──────────────────────────────────────────

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      // Step 1: Fetch all completed workout IDs for this user
      const { data: workouts, error: workoutsErr } = await supabase
        .from('workouts')
        .select('id, started_at')
        .eq('profile_id', user.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false });

      if (workoutsErr) throw workoutsErr;

      if (!workouts || workouts.length === 0) {
        setExercises([]);
        setLoading(false);
        return;
      }

      const completedWorkouts = workouts as CompletedWorkout[];
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
        .in('workout_id', workoutIds);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const toggleExpand = (exerciseName: string) => {
    setExpandedExercise((prev) =>
      prev === exerciseName ? null : exerciseName,
    );
  };

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

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

  // ─── Render: Empty State ──────────────────────────────

  if (exercises.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No Workouts Yet</Text>
        <Text style={styles.emptySubtitle}>
          Complete your first workout to see progress
        </Text>
      </View>
    );
  }

  // ─── Render: Exercise List ────────────────────────────

  const renderExerciseCard = ({ item }: { item: ExerciseSummary }) => {
    const isExpanded = expandedExercise === item.exerciseName;
    const hasPR = item.bestWeightKg > 0;

    return (
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

        {/* Expand indicator */}
        <Text style={styles.expandIndicator}>
          {isExpanded ? 'Hide details' : 'Tap for details'}
        </Text>

        {/* Expanded Session Details */}
        {isExpanded && (
          <View style={styles.sessionList}>
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
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Progress</Text>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.exerciseName}
        renderItem={renderExerciseCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    color: '#e63946',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ─── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    fontWeight: '700',
    color: '#212529',
  },
  sessionCount: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  prBadge: {
    backgroundColor: '#2a9d8f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  prBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // ─── PR Row ─────────────────────────────────────────────
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  prItem: {
    alignItems: 'center',
    flex: 1,
  },
  prLabel: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  prValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  // ─── Expand ─────────────────────────────────────────────
  expandIndicator: {
    fontSize: 13,
    color: '#4361ee',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  // ─── Session Details ────────────────────────────────────
  sessionList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 10,
  },
  sessionEntry: {
    marginBottom: 16,
  },
  sessionDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
  },
  noSetsText: {
    fontSize: 13,
    color: '#6c757d',
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  setsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  setsTableHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dee2e6',
  },
  setNumber: {
    flex: 1,
    fontSize: 14,
    color: '#4361ee',
    fontWeight: '600',
  },
  setDetail: {
    flex: 1,
    fontSize: 14,
    color: '#212529',
    fontWeight: '500',
  },
});
