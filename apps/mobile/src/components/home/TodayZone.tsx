/**
 * TodayZone — What to do today. Mode-aware. Based on DOC_07 Part 2D.
 * Restyled to the NEXTERA Red-Luxury system (design/stitch §7.2 "TODAY"
 * card): L2 card, 22px radius, hairline border, crimson kicker, mono
 * set/rep numbers, crimson CTA with glow.
 */
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

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
    <View style={[rowStyles.container, position > 1 && rowStyles.bordered]}>
      <View style={rowStyles.number}>
        <Text style={rowStyles.numberText}>{position}</Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name}>{exercise.exercise_name}</Text>
      </View>
      <Text style={rowStyles.meta}>
        {exercise.default_sets}×{exercise.default_reps}
      </Text>
    </View>
  );
}

function ViewProgramLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel="View full program"
      style={linkStyles.container}
    >
      <Text style={linkStyles.text}>View full program →</Text>
    </TouchableOpacity>
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
          style={[sectionStyles.cta, sectionStyles.ctaSuccess]}
          onPress={() => router.push(`/workout/${activeWorkoutId}?intent=${sessionIntent}`)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue workout"
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
          <Text style={sectionStyles.doneEmoji}>{'✅'}</Text>
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
            <Text style={sectionStyles.tipIcon}>{'💡'}</Text>
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

        <ViewProgramLink onPress={() => router.push('/program' as any)} />
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
          <View style={sectionStyles.headerText}>
            <Text style={sectionStyles.kicker}>TODAY</Text>
            <Text style={sectionStyles.dayName}>{todayWorkout.dayName}</Text>
          </View>
          <View style={sectionStyles.metaChip}>
            <Text style={sectionStyles.metaChipText}>
              {todayWorkout.exercises.length} EX · ~{duration.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={sectionStyles.exerciseList}>
          {todayWorkout.exercises.map((ex, i) => (
            <ExerciseRow key={ex.id} exercise={ex} position={i + 1} />
          ))}
        </View>

        <TouchableOpacity
          style={sectionStyles.cta}
          onPress={() => router.push('/(tabs)/scan')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Start today's workout"
        >
          <Text style={sectionStyles.ctaText}>Start today's workout →</Text>
        </TouchableOpacity>

        <ViewProgramLink onPress={() => router.push('/program' as any)} />
      </AnimatedCard>
    );
  }

  // No program — freestyle prompt
  return (
    <AnimatedCard index={1} style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <View style={sectionStyles.headerText}>
          <Text style={sectionStyles.kicker}>TODAY</Text>
          <Text style={sectionStyles.dayName}>Freestyle session</Text>
        </View>
      </View>
      <Text style={sectionStyles.freeText}>
        Scan any machine to start logging. No plan needed.
      </Text>
      <TouchableOpacity
        style={sectionStyles.cta}
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open scanner"
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  dayName: {
    fontSize: typography.h4Size + 1,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  metaChip: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  exerciseList: {
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    // Sanctioned crimson glow behind the primary CTA (design.md §3.11)
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  ctaSuccess: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
  },
  freeText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
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
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  doneSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nextPreview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nextLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  nextName: {
    fontSize: 15,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  nextMeta: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
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
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coachingText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

const linkStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  text: {
    fontSize: 13,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  bordered: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
});
