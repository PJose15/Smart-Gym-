/**
 * ProgramDayCard — single program day with today highlight, completion check,
 * and tappable exercise rows.
 *
 * Props:
 *   day     — ProgramDay (day_number, name, exercises)
 *   status  — 'complete' | 'today' | 'upcoming'
 *   onExercisePress — called with exercise_name (for /exercise/[name] routing)
 *
 * Used by app/program/index.tsx (PROG-02, PROG-03).
 * All design tokens from src/theme/* — zero hardcoded hex.
 */
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatSetsReps } from '../../lib/programLogic';
import type { ProgramDay } from '../../lib/programService';

interface ProgramDayCardProps {
  day: ProgramDay;
  status: 'complete' | 'today' | 'upcoming';
  onExercisePress: (exerciseName: string) => void;
}

export function ProgramDayCard({ day, status, onExercisePress }: ProgramDayCardProps) {
  const isToday = status === 'today';
  const isComplete = status === 'complete';

  return (
    <View
      style={[
        styles.card,
        isToday && styles.cardToday,
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dayLabel}>DAY {day.day_number}</Text>
          <Text style={styles.dayName}>{day.name}</Text>
        </View>

        {/* Status affordance */}
        {isComplete && (
          <Text style={styles.checkmark}>✓</Text>
        )}
        {isToday && (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>TODAY</Text>
          </View>
        )}
      </View>

      {/* Exercise rows */}
      {day.exercises.length > 0 ? (
        <View style={styles.exerciseList}>
          {day.exercises.map((exercise, i) => (
            <TouchableOpacity
              key={exercise.exercise_name + i}
              style={[styles.exerciseRow, i > 0 && styles.exerciseRowBordered]}
              onPress={() => onExercisePress(exercise.exercise_name)}
              accessibilityRole="link"
              accessibilityLabel={`View ${exercise.exercise_name} history`}
              activeOpacity={0.7}
            >
              <View style={styles.exerciseNumber}>
                <Text style={styles.exerciseNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
              </View>
              <Text style={styles.exerciseMeta}>
                {formatSetsReps(exercise.default_sets, exercise.default_reps)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardToday: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  dayLabel: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayName: {
    fontSize: typography.bodyLgSize,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  checkmark: {
    fontSize: typography.h4Size,
    color: colors.success,
    fontFamily: typography.fontBold,
    marginLeft: spacing.sm,
  },
  todayPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: spacing.sm,
    alignSelf: 'flex-start',
  },
  todayPillText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontBold,
    color: colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  exerciseRowBordered: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  exerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: 11,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
  exerciseMeta: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
});
