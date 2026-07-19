import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { Card } from '../Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
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
  strength: '🏋️',
  hypertrophy: '💪',
  endurance: '🏃',
  general: '🤸',
};

const GOAL_TEXT: Record<string, string> = {
  strength: 'Training for strength — heavy loads, lower reps.',
  hypertrophy: 'Training for muscle growth — moderate loads, volume-focused.',
  endurance: 'Training for endurance — lighter loads, higher reps.',
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
      {/* Lifetime Stats — 2x2 stat tile grid (design: 4-stat row, mono numbers) */}
      {lifetimeStats && lifetimeStats.totalWorkouts > 0 && (
        <AnimatedCard index={0} style={styles.gridWrap}>
          <View style={styles.grid}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>SESSIONS</Text>
              <Text style={styles.statValue}>{lifetimeStats.totalWorkouts}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>VOLUME</Text>
              <Text style={styles.statValue}>
                {lifetimeStats.totalVolumeKg >= 1000
                  ? `${(lifetimeStats.totalVolumeKg / 1000).toFixed(1)}t`
                  : formatWeight(lifetimeStats.totalVolumeKg, weightUnit)}
              </Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>SETS</Text>
              <Text style={styles.statValue}>{lifetimeStats.totalSets}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>TIME IN GYM</Text>
              <Text style={styles.statValue}>
                {lifetimeStats.totalTimeMinutes >= 60
                  ? `${Math.floor(lifetimeStats.totalTimeMinutes / 60)}h`
                  : `${lifetimeStats.totalTimeMinutes}m`}
              </Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Training Consistency */}
      {avgWorkoutsPerWeek !== null && (
        <AnimatedCard index={1} style={styles.card}>
          <View style={styles.consistencyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>TRAINING CONSISTENCY</Text>
              <Text style={styles.consistencyValue}>
                <Text style={styles.consistencyNumber}>{avgWorkoutsPerWeek}</Text>
                {'  workouts / week'}
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
              ? 'Elite consistency — you rarely miss a week.'
              : avgWorkoutsPerWeek >= 3
                ? 'Strong habit — keep this rhythm going.'
                : avgWorkoutsPerWeek >= 2
                  ? 'Solid foundation — an extra day would accelerate gains.'
                  : 'Building momentum — consistency is the #1 factor for results.'}
          </Text>
        </AnimatedCard>
      )}

      {/* Favorite Machines */}
      {favoriteMachines.length > 0 && (
        <AnimatedCard index={2} style={styles.card}>
          <Text style={styles.sectionTitle}>MOST USED MACHINES</Text>
          {favoriteMachines.map((m, i) => (
            <TouchableOpacity
              key={m.slug}
              style={[styles.favoriteRow, i === favoriteMachines.length - 1 && styles.favoriteRowLast]}
              onPress={() => router.push(`/machine/${m.slug}` as any)}
            >
              <Text style={styles.favoriteRank}>{i + 1}</Text>
              <Text variant="body" style={styles.favoriteName}>{m.name}</Text>
              <Text style={styles.favoriteCount}>{m.count}x</Text>
            </TouchableOpacity>
          ))}
        </AnimatedCard>
      )}

      {/* Goal Alignment */}
      {trainingGoal && trainingGoal !== 'general' && (
        <AnimatedCard index={3} style={styles.card}>
          <View style={styles.goalRow}>
            <Text style={styles.goalEmoji}>{GOAL_EMOJI[trainingGoal] ?? '🎯'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, styles.goalTitle]}>CURRENT FOCUS</Text>
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
            <Text style={styles.pointsLabel}>TOTAL POINTS</Text>
          </View>
        </AnimatedCard>
      )}
    </View>
  );
}

const cardBase = {
  backgroundColor: colors.surfaceElevated,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  shadowOpacity: 0,
  elevation: 0,
} as const;

const styles = StyleSheet.create({
  card: {
    ...cardBase,
    marginBottom: spacing.md,
  },
  gridWrap: {
    backgroundColor: colors.transparent,
    borderRadius: 0,
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
  },
  statTile: {
    ...cardBase,
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.8,
    color: colors.text,
    lineHeight: 30,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  consistencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  consistencyValue: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
  },
  consistencyNumber: {
    fontSize: 18,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
  },
  barBg: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  favoriteRowLast: {
    borderBottomWidth: 0,
  },
  favoriteRank: {
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
    width: 30,
  },
  favoriteName: {
    flex: 1,
    fontFamily: typography.fontMedium,
  },
  favoriteCount: {
    fontSize: 13,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalEmoji: {
    fontSize: 32,
  },
  goalTitle: {
    color: colors.primaryLight,
  },
  goalText: {
    fontFamily: typography.fontMedium,
    lineHeight: 20,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  pointsValue: {
    fontSize: 32,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -1,
    color: colors.primaryLight,
  },
  pointsLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
});
