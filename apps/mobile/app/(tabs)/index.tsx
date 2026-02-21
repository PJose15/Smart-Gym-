import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../src/lib/supabase';
import { getTodaysProgramDay } from '@smartgym/utils';
import { getTodayExplanation } from '@smartgym/ai-assist';
import { isFeatureEnabled, needsRefresh, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { Button, Text, Card } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { TodayExplanation, UserGoal } from '@smartgym/types';

interface TodayWorkout {
  dayName: string;
  exercises: Array<{
    id: string;
    exercise_name: string;
    default_sets: number;
    default_reps: number;
    machine_id: string | null;
  }>;
}

interface ActiveWorkout {
  id: string;
  started_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [explanation, setExplanation] = useState<TodayExplanation | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Refresh feature flags if stale
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      // Load profile name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      setUserName(profileData?.full_name || null);

      // Check for active workout
      const { data: activeData } = await supabase
        .from('workouts')
        .select('id, started_at')
        .eq('profile_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveWorkout(activeData || null);

      // Load gym membership
      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!memberData?.gym_id) {
        setLoading(false);
        return;
      }

      const gymId = memberData.gym_id;

      // Load program assignment
      const { data: assignment } = await supabase
        .from('member_program_assignments')
        .select('program_id, assigned_at')
        .eq('profile_id', user.id)
        .eq('gym_id', gymId)
        .limit(1)
        .maybeSingle();

      if (!assignment) {
        setLoading(false);
        return;
      }

      // Load program days
      const { data: days } = await supabase
        .from('program_days')
        .select('id, program_id, day_number, name')
        .eq('program_id', assignment.program_id)
        .order('day_number');

      if (!days || days.length === 0) {
        setLoading(false);
        return;
      }

      const todayDayNumber = getTodaysProgramDay(assignment.assigned_at, days.length);
      const todayDay = days.find((d) => d.day_number === todayDayNumber) || days[0];

      // Load exercises for today
      const { data: exercises } = await supabase
        .from('program_exercises')
        .select('id, exercise_name, default_sets, default_reps, machine_id')
        .eq('program_day_id', todayDay.id)
        .order('order_index');

      const todayExercises = exercises || [];

      setTodayWorkout({
        dayName: todayDay.name,
        exercises: todayExercises,
      });

      // Load "Why This Today" explanation if feature enabled
      if (isFeatureEnabled('why_this_today_enabled') && todayExercises.length > 0) {
        // Load training profile for goal
        const { data: trainingProfile } = await supabase
          .from('user_training_profiles')
          .select('goal')
          .eq('profile_id', user.id)
          .eq('gym_id', gymId)
          .maybeSingle();

        // Build muscle gap map: for each exercise's target muscles,
        // find when that muscle was last worked
        const muscleGaps: Record<string, number> = {};
        const machineIds = todayExercises
          .map((e) => e.machine_id)
          .filter((id): id is string => id !== null);

        if (machineIds.length > 0) {
          const { data: machines } = await supabase
            .from('machines')
            .select('id, target_muscles')
            .in('id', machineIds);

          if (machines) {
            const allMuscles = new Set<string>();
            for (const m of machines) {
              for (const muscle of m.target_muscles) {
                allMuscles.add(muscle);
              }
            }

            // For each muscle, find the most recent workout that used it
            for (const muscle of allMuscles) {
              const { data: lastWorkout } = await supabase
                .from('workout_exercises')
                .select('workout_id, workouts!inner(started_at)')
                .eq('workouts.profile_id', user.id)
                .eq('workouts.status', 'completed')
                .order('workouts(started_at)', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (lastWorkout) {
                const workoutRow = lastWorkout.workouts as unknown as { started_at: string };
                const daysAgo = Math.floor(
                  (Date.now() - new Date(workoutRow.started_at).getTime()) / (1000 * 60 * 60 * 24),
                );
                if (daysAgo > 0) {
                  muscleGaps[muscle] = daysAgo;
                }
              }
            }
          }
        }

        try {
          const exp = await getTodayExplanation({
            programDay: todayDay,
            exercises: todayExercises.map((e) => ({
              id: e.id,
              program_day_id: todayDay.id,
              machine_id: e.machine_id,
              exercise_name: e.exercise_name,
              order_index: 0,
              default_sets: e.default_sets,
              default_reps: e.default_reps,
            })),
            goal: (trainingProfile?.goal as UserGoal | undefined) || 'general',
            lastMuscleWorkouts: Object.keys(muscleGaps).length > 0 ? muscleGaps : undefined,
          });
          setExplanation(exp);
        } catch {
          // Non-critical — skip explanation
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load home');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  }, [loadHome]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="textSecondary" style={styles.loadingText}>
          Loading...
        </Text>
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

      <Text variant="heading" style={styles.greeting}>
        {userName ? `Hey, ${userName.split(' ')[0]}` : 'Welcome back'}
      </Text>

      {activeWorkout && (
        <Card style={styles.activeCard}>
          <Text variant="label" style={styles.activeLabel}>Workout in Progress</Text>
          <Text variant="caption" color="textSecondary" style={styles.activeStarted}>
            Started {new Date(activeWorkout.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Button
            title="Continue Workout"
            onPress={() => router.push(`/workout/${activeWorkout.id}`)}
            style={styles.continueButton}
          />
        </Card>
      )}

      {todayWorkout ? (
        <View style={styles.todaySection}>
          <Text variant="label" style={styles.sectionTitle}>
            Today: {todayWorkout.dayName}
          </Text>

          {todayWorkout.exercises.map((exercise) => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <Text variant="body" style={styles.exerciseName}>
                {exercise.exercise_name}
              </Text>
              <Text variant="caption" color="textSecondary">
                {exercise.default_sets} sets x {exercise.default_reps} reps
              </Text>
            </Card>
          ))}

          {explanation && (
            <Card style={styles.explanationCard}>
              <Text variant="label" style={styles.explanationTitle}>
                Why This Today?
              </Text>
              <Text variant="body" color="textSecondary" style={styles.explanationText}>
                {explanation.reasoning}
              </Text>
              {explanation.focus_muscles.length > 0 && (
                <View style={styles.muscleRow}>
                  {explanation.focus_muscles.map((muscle) => (
                    <View key={muscle} style={styles.muscleTag}>
                      <Text variant="caption" style={styles.muscleTagText}>{muscle}</Text>
                    </View>
                  ))}
                </View>
              )}
              {explanation.last_workout_gap_text && (
                <Text variant="caption" color="textSecondary" style={styles.gapText}>
                  {explanation.last_workout_gap_text}
                </Text>
              )}
            </Card>
          )}

          {!activeWorkout && (
            <Button
              title="Start Workout"
              onPress={() => router.push('/workout/start')}
              style={styles.startButton}
            />
          )}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <Text variant="body" color="textSecondary" style={styles.emptyText}>
            No program assigned yet. Ask your trainer to set one up!
          </Text>
        </Card>
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
  greeting: {
    marginBottom: spacing.lg,
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
  activeCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  activeLabel: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  activeStarted: {
    marginBottom: spacing.sm,
  },
  continueButton: {
    marginTop: spacing.xs,
  },
  todaySection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  explanationCard: {
    padding: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  explanationTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
    color: colors.primary,
  },
  explanationText: {
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  muscleTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  muscleTagText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  gapText: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  startButton: {
    marginTop: spacing.md,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
});
