import { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { Button, Text, Card } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { getTodaysProgramDay } from '@smartgym/utils';
import type {
  Workout,
  Program,
  ProgramDay,
  ProgramExercise,
} from '@smartgym/types';

// ─── Local Types ────────────────────────────────────────

// Temporary local definition until added to @smartgym/types
export interface MemberProgramAssignment {
  id: string;
  profile_id: string;
  program_id: string;
  assigned_at: string;
}

interface ProgramDayWithExercises extends ProgramDay {
  program_exercises: ProgramExercise[];
}

interface ProgramWithDays extends Program {
  program_days: ProgramDayWithExercises[];
}

interface AssignmentWithProgram extends MemberProgramAssignment {
  programs: ProgramWithDays;
}

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [assignment, setAssignment] = useState<AssignmentWithProgram | null>(null);
  const [todayDay, setTodayDay] = useState<ProgramDayWithExercises | null>(null);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

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
        .select('*, programs:program_id(id, name, description, gym_id, program_days(id, day_number, name, program_exercises(id, exercise_name, default_sets, default_reps, order_index, machine_id)))')
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
          const day = program.program_days.find((d) => d.day_number === dayNumber) || null;
          if (day) {
            // Sort exercises by order_index
            day.program_exercises.sort((a, b) => a.order_index - b.order_index);
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
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleStartWorkout = async () => {
    if (!assignment || !todayDay || !userId) return;

    try {
      setStartingWorkout(true);
      setError(null);

      const gymId = assignment.programs.gym_id;

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

  const handleStartEmptyWorkout = async () => {
    if (!userId) return;

    try {
      setStartingWorkout(true);
      setError(null);

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
          setError('You need to join a gym first. Scan a machine QR code to get started.');
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="textSecondary" style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.centered}>
        <Text variant="heading" style={styles.title}>Welcome to SmartGym</Text>
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          Scan a QR code on any machine to get started
        </Text>
        <Button
          title="Scan Machine QR"
          onPress={() => router.push('/(tabs)/scan')}
          style={styles.fullWidth}
        />
        <Button
          title="Sign In / Sign Up"
          onPress={() => router.push('/auth')}
          variant="outline"
          style={[styles.fullWidth, { marginTop: spacing.md }]}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text variant="caption" style={styles.errorText}>{error}</Text>
        </View>
      )}

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
                Started {new Date(activeWorkout.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.resumeButtonContainer}>
              <Text style={styles.resumeButtonText} >Continue</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {assignment && todayDay && !activeWorkout && (
        <Card style={styles.card}>
          <Text variant="heading" style={styles.cardTitle}>Today's Workout</Text>
          <Text variant="subheading" style={styles.dayName}>{todayDay.name}</Text>
          <Text variant="caption" style={styles.programName}>{assignment.programs.name}</Text>

          <View style={styles.exerciseList}>
            {todayDay.program_exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <Text variant="body" style={styles.exerciseName}>{exercise.exercise_name}</Text>
                <Text variant="caption" color="textSecondary" style={styles.exerciseMeta}>
                  {exercise.default_sets} x {exercise.default_reps}
                </Text>
              </View>
            ))}
          </View>

          <Button
            title="Start Workout"
            onPress={handleStartWorkout}
            loading={startingWorkout}
            disabled={startingWorkout}
            style={styles.fullWidth}
          />
        </Card>
      )}

      {!assignment && !activeWorkout && (
        <Card style={styles.card}>
          <Text variant="heading" style={styles.cardTitle}>Ready to Train?</Text>
          <Text variant="body" color="textSecondary" style={styles.cardSubtitle}>
            Scan a machine QR code to discover exercises, or start a quick freestyle workout.
          </Text>
          <Button
            title="Scan Machine QR"
            onPress={() => router.push('/(tabs)/scan')}
            style={styles.fullWidth}
          />
        </Card>
      )}

      {!activeWorkout && (
        <Button
          title="Start Empty Workout"
          onPress={handleStartEmptyWorkout}
          variant="outline"
          loading={startingWorkout}
          disabled={startingWorkout}
          style={[styles.fullWidth, { marginTop: spacing.md }]}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  resumeCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  resumeButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    marginBottom: spacing.lg,
  },
  dayName: {
    color: colors.primary,
    marginTop: spacing.xs,
  },
  programName: {
    marginTop: 2,
    marginBottom: spacing.md,
  },
  exerciseList: {
    marginBottom: spacing.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseName: {
    flex: 1,
  },
  exerciseMeta: {
    marginLeft: spacing.md,
  },
  fullWidth: {
    width: '100%',
  },
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
});
