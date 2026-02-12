import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { getTodaysProgramDay } from '@smartgym/utils';
import type {
  Workout,
  MemberProgramAssignment,
  Program,
  ProgramDay,
  ProgramExercise,
} from '@smartgym/types';

// ─── Local Types ────────────────────────────────────────

interface ProgramDayWithExercises extends ProgramDay {
  program_exercises: ProgramExercise[];
}

interface ProgramWithDays extends Program {
  program_days: ProgramDayWithExercises[];
}

interface AssignmentWithProgram extends MemberProgramAssignment {
  programs: ProgramWithDays;
}

// ─── Component ──────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [assignment, setAssignment] = useState<AssignmentWithProgram | null>(
    null,
  );
  const [todayDay, setTodayDay] = useState<ProgramDayWithExercises | null>(
    null,
  );
  const [startingWorkout, setStartingWorkout] = useState(false);
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
        setActiveWorkout(null);
        setAssignment(null);
        setTodayDay(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Check for active workout
      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .select('*')
        .eq('profile_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (workoutErr) throw workoutErr;
      setActiveWorkout(workout);

      // Check for assigned program
      const { data: assignmentData, error: assignmentErr } = await supabase
        .from('member_program_assignments')
        .select(
          '*, programs:program_id(id, name, description, gym_id, program_days(id, day_number, name, program_exercises(id, exercise_name, default_sets, default_reps, order_index, machine_id)))',
        )
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (assignmentErr) throw assignmentErr;

      if (assignmentData) {
        const typed = assignmentData as unknown as AssignmentWithProgram;
        setAssignment(typed);

        const program = typed.programs;
        const totalDays = program.program_days.length;
        if (totalDays > 0) {
          const dayNumber = getTodaysProgramDay(typed.assigned_at, totalDays);
          const day =
            program.program_days.find((d) => d.day_number === dayNumber) ||
            null;
          if (day) {
            // Sort exercises by order_index
            day.program_exercises.sort(
              (a, b) => a.order_index - b.order_index,
            );
          }
          setTodayDay(day);
        } else {
          setTodayDay(null);
        }
      } else {
        setAssignment(null);
        setTodayDay(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

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

  // ─── Start Workout from Program ─────────────────────

  const handleStartWorkout = async () => {
    if (!assignment || !todayDay || !userId) return;

    try {
      setStartingWorkout(true);
      setError(null);

      const gymId = assignment.programs.gym_id;

      // Create a new workout
      const { data: newWorkout, error: createErr } = await supabase
        .from('workouts')
        .insert({
          gym_id: gymId,
          profile_id: userId,
          status: 'in_progress' as const,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // Create workout exercises from the program day
      const exerciseRows = todayDay.program_exercises.map((pe, idx) => ({
        workout_id: newWorkout.id,
        machine_id: pe.machine_id || null,
        exercise_name: pe.exercise_name,
        order_index: idx,
      }));

      if (exerciseRows.length > 0) {
        const { error: exErr } = await supabase
          .from('workout_exercises')
          .insert(exerciseRows);

        if (exErr) throw exErr;
      }

      router.push(`/workout/${newWorkout.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setStartingWorkout(false);
    }
  };

  // ─── Start Empty Workout ────────────────────────────

  const handleStartEmptyWorkout = async () => {
    if (!userId) return;

    try {
      setStartingWorkout(true);
      setError(null);

      // Get gym_id from assignment if available, otherwise from gym membership
      let gymId: string | null = null;

      if (assignment) {
        gymId = assignment.programs.gym_id;
      } else {
        const { data: membership, error: memErr } = await supabase
          .from('gym_members')
          .select('gym_id')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();

        if (memErr) throw memErr;
        if (!membership) {
          setError(
            'You need to join a gym first. Scan a machine QR code to get started.',
          );
          return;
        }
        gymId = membership.gym_id;
      }

      const { data: newWorkout, error: createErr } = await supabase
        .from('workouts')
        .insert({
          gym_id: gymId,
          profile_id: userId,
          status: 'in_progress' as const,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      router.push(`/workout/${newWorkout.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start workout');
    } finally {
      setStartingWorkout(false);
    }
  };

  // ─── Render: Loading ──────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // ─── Render: Not Signed In ────────────────────────────

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Welcome to SmartGym</Text>
        <Text style={styles.subtitle}>
          Scan a QR code on any machine to get started
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <Text style={styles.primaryButtonText}>Scan Machine QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.fullWidth, { marginTop: 14 }]}
          onPress={() => router.push('/auth')}
        >
          <Text style={styles.secondaryButtonText}>Sign In / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Signed In ────────────────────────────────

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* A) Active Workout Banner */}
      {activeWorkout && (
        <TouchableOpacity
          style={styles.resumeCard}
          onPress={() => router.push(`/workout/${activeWorkout.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.resumeCardInner}>
            <View>
              <Text style={styles.resumeLabel}>Active Workout</Text>
              <Text style={styles.resumeSubtext}>
                Started{' '}
                {new Date(activeWorkout.started_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.resumeButtonContainer}>
              <Text style={styles.resumeButtonText}>Continue Workout</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* B) Today's Workout from Program (no active workout) */}
      {assignment && todayDay && !activeWorkout && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Workout</Text>
          <Text style={styles.dayName}>{todayDay.name}</Text>
          <Text style={styles.programName}>{assignment.programs.name}</Text>

          <View style={styles.exerciseList}>
            {todayDay.program_exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>
                  {exercise.exercise_name}
                </Text>
                <Text style={styles.exerciseMeta}>
                  {exercise.default_sets} x {exercise.default_reps}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.fullWidth,
              startingWorkout && styles.disabledButton,
            ]}
            onPress={handleStartWorkout}
            disabled={startingWorkout}
          >
            {startingWorkout ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Start Workout</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Plan shown below resume card when there IS an active workout */}
      {assignment && todayDay && activeWorkout && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Plan</Text>
          <Text style={styles.dayName}>{todayDay.name}</Text>
          <Text style={styles.programName}>{assignment.programs.name}</Text>

          <View style={styles.exerciseList}>
            {todayDay.program_exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>
                  {exercise.exercise_name}
                </Text>
                <Text style={styles.exerciseMeta}>
                  {exercise.default_sets} x {exercise.default_reps}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* C) No Program Assigned, No Active Workout */}
      {!assignment && !activeWorkout && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready to Train?</Text>
          <Text style={styles.cardSubtitle}>
            Scan a machine QR code to discover exercises, or start a quick
            freestyle workout.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, styles.fullWidth]}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <Text style={styles.primaryButtonText}>Scan Machine QR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* D) Start Empty Workout (always visible when signed in + no active workout) */}
      {!activeWorkout && (
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            styles.fullWidth,
            startingWorkout && styles.disabledButton,
          ]}
          onPress={handleStartEmptyWorkout}
          disabled={startingWorkout}
        >
          {startingWorkout ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              Start Empty Workout
            </Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  // ─── Resume Workout Card ────────────────────────────────
  resumeCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resumeCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumeLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  resumeSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  resumeButtonContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resumeButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  // ─── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  dayName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  programName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
  // ─── Exercise List ──────────────────────────────────────
  exerciseList: {
    marginBottom: 16,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseName: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  exerciseMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginLeft: 12,
  },
  // ─── Buttons ────────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // ─── Error ──────────────────────────────────────────────
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
