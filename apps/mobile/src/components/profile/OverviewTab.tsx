import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { Card } from '../Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatWeight } from '@nexera/utils';
import type { WeightUnit, UserGoal } from '@nexera/types';

interface LifetimeStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalTimeMinutes: number;
}

interface FavoriteMachine {
  name: string;
  count: number;
  slug: string;
}

interface OverviewTabProps {
  lifetimeStats: LifetimeStats | null;
  avgWorkoutsPerWeek: number | null;
  favoriteMachines: FavoriteMachine[];
  trainingGoal: UserGoal | null;
  weightUnit: WeightUnit;
  totalPoints: number;
}

const GOAL_EMOJI: Record<string, string> = {
  strength: '\uD83C\uDFCB\uFE0F',
  hypertrophy: '\uD83D\uDCAA',
  endurance: '\uD83C\uDFC3',
  general: '\uD83E\uDD38',
};

const GOAL_TEXT: Record<string, string> = {
  strength: 'Training for strength \u2014 heavy loads, lower reps.',
  hypertrophy: 'Training for muscle growth \u2014 moderate loads, volume-focused.',
  endurance: 'Training for endurance \u2014 lighter loads, higher reps.',
};

export function OverviewTab({
  lifetimeStats,
  avgWorkoutsPerWeek,
  favoriteMachines,
  trainingGoal,
  weightUnit,
  totalPoints,
}: OverviewTabProps) {
  const router = useRouter();

  return (
    <View>
      {/* Lifetime Stats */}
      {lifetimeStats && lifetimeStats.totalWorkouts > 0 && (
        <AnimatedCard index={0} style={styles.card}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Lifetime Stats
          </Text>
          <View style={styles.grid}>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{lifetimeStats.totalWorkouts}</Text>
              <Text variant="caption" color="textSecondary">workouts</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>
                {lifetimeStats.totalVolumeKg >= 1000
                  ? `${(lifetimeStats.totalVolumeKg / 1000).toFixed(1)}t`
                  : formatWeight(lifetimeStats.totalVolumeKg, weightUnit)}
              </Text>
              <Text variant="caption" color="textSecondary">volume</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{lifetimeStats.totalSets}</Text>
              <Text variant="caption" color="textSecondary">sets</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>
                {lifetimeStats.totalTimeMinutes >= 60
                  ? `${Math.floor(lifetimeStats.totalTimeMinutes / 60)}h`
                  : `${lifetimeStats.totalTimeMinutes}m`}
              </Text>
              <Text variant="caption" color="textSecondary">time in gym</Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Training Consistency */}
      {avgWorkoutsPerWeek !== null && (
        <AnimatedCard index={1} style={styles.card}>
          <View style={styles.consistencyRow}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
                Training Consistency
              </Text>
              <Text style={styles.consistencyValue}>
                {avgWorkoutsPerWeek} workouts / week
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.min(100, (avgWorkoutsPerWeek / 5) * 100)}%` },
                ]}
              />
            </View>
          </View>
          <Text variant="caption" color="textSecondary">
            {avgWorkoutsPerWeek >= 4
              ? 'Elite consistency \u2014 you rarely miss a week.'
              : avgWorkoutsPerWeek >= 3
                ? 'Strong habit \u2014 keep this rhythm going.'
                : avgWorkoutsPerWeek >= 2
                  ? 'Solid foundation \u2014 an extra day would accelerate gains.'
                  : 'Building momentum \u2014 consistency is the #1 factor for results.'}
          </Text>
        </AnimatedCard>
      )}

      {/* Favorite Machines */}
      {favoriteMachines.length > 0 && (
        <AnimatedCard index={2} style={styles.card}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Most Used Machines
          </Text>
          {favoriteMachines.map((m, i) => (
            <TouchableOpacity
              key={m.slug}
              style={styles.favoriteRow}
              onPress={() => router.push(`/machine/${m.slug}` as any)}
            >
              <Text style={styles.favoriteRank}>#{i + 1}</Text>
              <Text variant="body" style={styles.favoriteName}>{m.name}</Text>
              <Text variant="caption" color="textSecondary">{m.count}x</Text>
            </TouchableOpacity>
          ))}
        </AnimatedCard>
      )}

      {/* Goal Alignment */}
      {trainingGoal && trainingGoal !== 'general' && (
        <AnimatedCard index={3} style={styles.card}>
          <View style={styles.goalRow}>
            <Text style={styles.goalEmoji}>{GOAL_EMOJI[trainingGoal] ?? '\uD83C\uDFAF'}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
                Your Focus
              </Text>
              <Text variant="body" style={styles.goalText}>
                {GOAL_TEXT[trainingGoal] ?? ''}
              </Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Points Summary */}
      {totalPoints > 0 && (
        <AnimatedCard index={4} style={styles.card}>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsValue}>{totalPoints.toLocaleString()}</Text>
            <Text variant="caption" color="textSecondary"> total points</Text>
          </View>
        </AnimatedCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    alignItems: 'center',
    flex: 1,
  },
  pillValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  consistencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  consistencyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  barBg: {
    width: 60,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  favoriteRank: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    width: 30,
  },
  favoriteName: {
    flex: 1,
    fontWeight: '500',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalEmoji: {
    fontSize: 32,
  },
  goalText: {
    fontWeight: '500',
    lineHeight: 20,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
});
