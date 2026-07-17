/**
 * MomentumZone — Streak, weekly stats, level progress. Based on DOC_07 Part 2E.
 */
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { StreakFlame } from '../gamification/StreakFlame';

interface MomentumZoneProps {
  streak: number;
  weeklyWorkouts: number;
  weeklyGoal: number;
  weeklyVolume: number;
  level: number;
  score: number;
}

function MomentumTile({
  icon,
  iconNode,
  value,
  label,
  sub,
  accentColor,
}: {
  icon?: string;
  iconNode?: ReactNode;
  value: string;
  label: string;
  sub?: string;
  accentColor: string;
}) {
  return (
    <View style={tileStyles.container}>
      {iconNode ? (
        <View style={tileStyles.iconNode}>{iconNode}</View>
      ) : (
        <Text style={tileStyles.icon}>{icon}</Text>
      )}
      <Text style={[tileStyles.value, { color: accentColor }]}>{value}</Text>
      <Text style={tileStyles.label}>{label}</Text>
      {sub && <Text style={tileStyles.sub}>{sub}</Text>}
    </View>
  );
}

function getStreakContext(streak: number): string {
  if (streak >= 30) return 'Legendary';
  if (streak >= 14) return 'On fire';
  if (streak >= 7) return 'Building';
  if (streak >= 3) return 'Rolling';
  return '';
}

export function MomentumZone({
  streak,
  weeklyWorkouts,
  weeklyGoal,
  weeklyVolume,
  level,
  score,
}: MomentumZoneProps) {
  const volumeStr = weeklyVolume >= 1000
    ? `${(weeklyVolume / 1000).toFixed(1)}t`
    : `${weeklyVolume.toLocaleString()} lbs`;

  const weekProgress = weeklyGoal > 0
    ? Math.min((weeklyWorkouts / weeklyGoal) * 100, 100)
    : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Momentum</Text>

      <View style={styles.tilesRow}>
        <MomentumTile
          iconNode={<StreakFlame streakWeeks={streak} size={18} />}
          value={`${streak}`}
          label="day streak"
          sub={getStreakContext(streak) || undefined}
          accentColor={colors.amber}
        />
        <MomentumTile
          icon={'\uD83C\uDFCB\uFE0F'}
          value={`${weeklyWorkouts}/${weeklyGoal}`}
          label="this week"
          sub={volumeStr}
          accentColor={colors.primary}
        />
        <MomentumTile
          icon={'\u2B50'}
          value={`${level}`}
          label="level"
          sub={`${score.toLocaleString()} pts`}
          accentColor={colors.purple}
        />
      </View>

      {/* Weekly progress bar */}
      {weeklyGoal > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${weekProgress}%` as `${number}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {weeklyWorkouts >= weeklyGoal
              ? 'Weekly goal reached!'
              : `${weeklyGoal - weeklyWorkouts} session${weeklyGoal - weeklyWorkouts !== 1 ? 's' : ''} to go`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});

const tileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 20,
    marginBottom: 4,
  },
  iconNode: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
