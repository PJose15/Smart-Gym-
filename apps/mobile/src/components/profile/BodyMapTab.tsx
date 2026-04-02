import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { Card } from '../Card';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { MuscleMapCacheResult, MuscleMapEntry } from '../../lib/memberData';

interface BodyMapTabProps {
  muscleMap: MuscleMapCacheResult | null;
}

const STATE_COLORS: Record<string, string> = {
  fresh: colors.success,
  primed: colors.primary,
  recovering: colors.gold,
  fatigued: colors.error,
};

const STATE_LABELS: Record<string, string> = {
  fresh: 'Fresh',
  primed: 'Primed',
  recovering: 'Recovering',
  fatigued: 'Fatigued',
};

function MuscleRow({ muscle }: { muscle: MuscleMapEntry }) {
  const stateColor = STATE_COLORS[muscle.state] ?? colors.textSecondary;
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.info}>
        <Text variant="body" style={rowStyles.name}>{muscle.label}</Text>
        <View style={[rowStyles.pill, { backgroundColor: stateColor + '20' }]}>
          <Text style={[rowStyles.pillText, { color: stateColor }]}>
            {STATE_LABELS[muscle.state] ?? muscle.state}
          </Text>
        </View>
      </View>
      <View style={rowStyles.barBg}>
        <View
          style={[
            rowStyles.barFill,
            {
              width: `${muscle.recovery_pct}%`,
              backgroundColor: stateColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function BodyMapTab({ muscleMap }: BodyMapTabProps) {
  if (!muscleMap) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'🏋️'}</Text>
        <Text variant="heading" style={styles.emptyTitle}>Muscle Map</Text>
        <Text variant="body" color="textSecondary" style={styles.emptyText}>
          Complete some workouts to see your muscle recovery status.
        </Text>
      </View>
    );
  }

  const { muscles, balance_score, recommendations } = muscleMap;

  // Sort: fatigued first, then recovering, primed, fresh
  const stateOrder: Record<string, number> = { fatigued: 0, recovering: 1, primed: 2, fresh: 3 };
  const sorted = [...muscles].sort(
    (a, b) => (stateOrder[a.state] ?? 4) - (stateOrder[b.state] ?? 4),
  );

  return (
    <View>
      {/* Balance Score */}
      <AnimatedCard index={0} style={styles.card}>
        <View style={styles.balanceRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
              Balance Score
            </Text>
            <Text style={styles.balanceValue}>{balance_score}</Text>
            <Text variant="caption" color="textSecondary">/100</Text>
          </View>
          <View style={styles.balanceBarBg}>
            <View
              style={[
                styles.balanceBarFill,
                {
                  width: `${balance_score}%`,
                  backgroundColor:
                    balance_score >= 70 ? colors.success
                      : balance_score >= 40 ? colors.gold
                        : colors.error,
                },
              ]}
            />
          </View>
        </View>
        <Text variant="caption" color="textSecondary">
          {balance_score >= 70
            ? 'Well-balanced training across muscle groups.'
            : balance_score >= 40
              ? 'Some imbalance detected. Consider varying your routine.'
              : 'Significant imbalance. Focus on undertrained muscle groups.'}
        </Text>
      </AnimatedCard>

      {/* Muscle Groups List */}
      <AnimatedCard index={1} style={styles.card}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
          Muscle Groups ({muscles.length})
        </Text>
        {/* State legend */}
        <View style={styles.legendRow}>
          {Object.entries(STATE_LABELS).map(([key, label]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATE_COLORS[key] }]} />
              <Text variant="caption" color="textSecondary" style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
        {sorted.map((m) => (
          <MuscleRow key={m.key} muscle={m} />
        ))}
      </AnimatedCard>

      {/* Recommendations */}
      {(recommendations.focus.length > 0 || recommendations.ready_to_train.length > 0) && (
        <AnimatedCard index={2} style={styles.card}>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Recommendations
          </Text>
          {recommendations.focus.length > 0 && (
            <View style={styles.recSection}>
              <Text variant="body" style={styles.recLabel}>Focus Areas</Text>
              <View style={styles.chipRow}>
                {recommendations.focus.map((f) => (
                  <View key={f} style={[styles.chip, { borderColor: colors.gold }]}>
                    <Text style={[styles.chipText, { color: colors.gold }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {recommendations.ready_to_train.length > 0 && (
            <View style={styles.recSection}>
              <Text variant="body" style={styles.recLabel}>Ready to Train</Text>
              <View style={styles.chipRow}>
                {recommendations.ready_to_train.map((m) => (
                  <View key={m} style={[styles.chip, { borderColor: colors.success }]}>
                    <Text style={[styles.chipText, { color: colors.success }]}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </AnimatedCard>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { fontWeight: '500', fontSize: 14 },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 36,
  },
  balanceBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  balanceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: { fontSize: 11 },
  recSection: {
    marginBottom: spacing.sm,
  },
  recLabel: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
