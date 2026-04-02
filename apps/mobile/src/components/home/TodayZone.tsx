/**
 * TodayZone — What to do today. Mode-aware. Based on DOC_07 Part 2D.
 */
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface TodayExercise {
  id: string;
  exercise_name: string;
  default_sets: number;
  default_reps: number;
  machine_id: string | null;
}

interface TodayZoneProps {
  todayWorkout: {
    dayName: string;
    exercises: TodayExercise[];
  } | null;
  todayDone: boolean;
  activeWorkoutId?: string | null;
  nextDayPreview?: { name: string; exerciseCount: number } | null;
  sessionIntent: string;
  restDayTip?: string;
  coachingMessage?: string | null;
  coachingSource?: string;
}

function ExerciseRow({ exercise, position }: { exercise: TodayExercise; position: number }) {
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.number}>
        <Text style={rowStyles.numberText}>{position}</Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name}>{exercise.exercise_name}</Text>
        <Text style={rowStyles.meta}>
          {exercise.default_sets} sets × {exercise.default_reps} reps
        </Text>
      </View>
    </View>
  );
}

export function TodayZone({
  todayWorkout,
  todayDone,
  activeWorkoutId,
  nextDayPreview,
  sessionIntent,
  restDayTip,
  coachingMessage,
  coachingSource,
}: TodayZoneProps) {
  const router = useRouter();

  // Active workout — show continue button
  if (activeWorkoutId) {
    return (
      <AnimatedCard index={1} style={sectionStyles.card}>
        <View style={sectionStyles.cardHeader}>
          <View style={[sectionStyles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={sectionStyles.cardTitle}>Workout in Progress</Text>
        </View>
        <TouchableOpacity
          style={[sectionStyles.cta, { backgroundColor: colors.success }]}
          onPress={() => router.push(`/workout/${activeWorkoutId}?intent=${sessionIntent}`)}
          activeOpacity={0.8}
        >
          <Text style={sectionStyles.ctaText}>Continue Workout →</Text>
        </TouchableOpacity>
      </AnimatedCard>
    );
  }

  // Rest day — today's workout is done
  if (todayWorkout && todayDone) {
    return (
      <AnimatedCard index={1} style={sectionStyles.card}>
        <View style={sectionStyles.doneHeader}>
          <Text style={sectionStyles.doneEmoji}>{'\u2705'}</Text>
          <View>
            <Text style={sectionStyles.doneTitle}>All done for today!</Text>
            <Text style={sectionStyles.doneSubtitle}>
              Great work completing {todayWorkout.dayName}. Time to recover.
            </Text>
          </View>
        </View>

        {nextDayPreview && (
          <View style={sectionStyles.nextPreview}>
            <Text style={sectionStyles.nextLabel}>NEXT UP</Text>
            <Text style={sectionStyles.nextName}>{nextDayPreview.name}</Text>
            <Text style={sectionStyles.nextMeta}>
              {nextDayPreview.exerciseCount} exercise{nextDayPreview.exerciseCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {restDayTip && (
          <View style={sectionStyles.tipBox}>
            <Text style={sectionStyles.tipIcon}>{'\uD83D\uDCA1'}</Text>
            <Text style={sectionStyles.tipText}>{restDayTip}</Text>
          </View>
        )}

        {coachingMessage && (
          <View style={sectionStyles.coaching}>
            <Text style={sectionStyles.coachingLabel}>
              {coachingSource === 'ai' ? 'AI Coach' : 'Coach Tip'}
            </Text>
            <Text style={sectionStyles.coachingText}>{coachingMessage}</Text>
          </View>
        )}
      </AnimatedCard>
    );
  }

  // Has program — show today's exercises
  if (todayWorkout) {
    const estMinutes = Math.round(
      todayWorkout.exercises.reduce((sum, e) => sum + e.default_sets, 0) * 2.5
    );
    const duration = estMinutes >= 60
      ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}min`
      : `${estMinutes} min`;

    return (
      <AnimatedCard index={1} style={sectionStyles.card}>
        <View style={sectionStyles.cardHeader}>
          <Text style={sectionStyles.cardTitle}>Today's Workout</Text>
          <Text style={sectionStyles.cardMeta}>
            {todayWorkout.exercises.length} exercises · ~{duration}
          </Text>
        </View>

        <Text style={sectionStyles.dayName}>{todayWorkout.dayName}</Text>

        <View style={sectionStyles.exerciseList}>
          {todayWorkout.exercises.map((ex, i) => (
            <ExerciseRow key={ex.id} exercise={ex} position={i + 1} />
          ))}
        </View>

        <TouchableOpacity
          style={sectionStyles.cta}
          onPress={() => router.push('/(tabs)/scan')}
          activeOpacity={0.8}
        >
          <Text style={sectionStyles.ctaText}>Start today's workout →</Text>
        </TouchableOpacity>
      </AnimatedCard>
    );
  }

  // No program — freestyle prompt
  return (
    <AnimatedCard index={1} style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <Text style={sectionStyles.cardTitle}>Today</Text>
        <Text style={sectionStyles.cardMeta}>Freestyle session</Text>
      </View>
      <Text style={sectionStyles.freeText}>
        Scan any machine to start logging. No plan needed.
      </Text>
      <TouchableOpacity
        style={sectionStyles.cta}
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.8}
      >
        <Text style={sectionStyles.ctaText}>Open Scanner →</Text>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  exerciseList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  freeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  doneEmoji: {
    fontSize: 32,
  },
  doneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  doneSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nextPreview: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nextLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  nextMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: colors.primarySubtle,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  coaching: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  coachingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coachingText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
});
