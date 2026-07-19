import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { MuscleMapCacheResult, MuscleMapEntry } from '../../lib/memberData';

interface BodyMapTabProps {
  muscleMap: MuscleMapCacheResult | null;
}

// Recovery heat scale — muscle* tokens (design.md §3.7 muscle recovery)
const STATE_COLORS: Record<string, string> = {
  fresh: colors.muscleFresh,
  primed: colors.musclePrimed,
  recovering: colors.muscleRecovering,
  fatigued: colors.muscleFatigued,
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
        <Text style={rowStyles.name}>{muscle.label}</Text>
        <View style={rowStyles.valueGroup}>
          <Text style={rowStyles.pct}>{muscle.recovery_pct}%</Text>
          <View style={[
            rowStyles.pill,
            { backgroundColor: stateColor + '14', borderColor: stateColor + '55' },
          ]}>
            <Text style={[rowStyles.pillText, { color: stateColor }]}>
              {STATE_LABELS[muscle.state] ?? muscle.state}
            </Text>
          </View>
        </View>
      </View>
      <View style={rowStyles.barBg}>
        <View
          style={[
            rowStyles.barFill,
            {
              width: `${muscle.recovery_pct}%`,
              backgroundColor: stateColor,
              shadowColor: stateColor,
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
        <Text style={styles.emptyTitle}>Recovery Telemetry</Text>
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

  const balanceColor =
    balance_score >= 70 ? colors.success
      : balance_score >= 40 ? colors.gold
        : colors.error;

  return (
    <View>
      {/* Balance Score — telemetry hero card */}
      <AnimatedCard index={0} style={styles.heroCard}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <Text style={styles.kicker}>RECOVERY TELEMETRY</Text>
        <View style={styles.balanceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>BALANCE SCORE</Text>
            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceValue}>{balance_score}</Text>
              <Text style={styles.balanceOutOf}>/ 100</Text>
            </View>
          </View>
          <View style={styles.balanceBarBg}>
            <View
              style={[
                styles.balanceBarFill,
                {
                  width: `${balance_score}%`,
                  backgroundColor: balanceColor,
                  shadowColor: balanceColor,
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

      {/* Muscle Groups List — systems diagnostics */}
      <AnimatedCard index={1} style={styles.card}>
        <Text style={styles.sectionTitle}>
          SYSTEMS DIAGNOSTICS <Text style={styles.sectionCount}>{muscles.length}</Text>
        </Text>
        {/* State legend — 4-swatch (design: muscle-map legend) */}
        <View style={styles.legendRow}>
          {Object.entries(STATE_LABELS).map(([key, label]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATE_COLORS[key] }]} />
              <Text style={styles.legendText}>{label}</Text>
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
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          {recommendations.focus.length > 0 && (
            <View style={styles.recSection}>
              <Text style={styles.recLabel}>Focus Areas</Text>
              <View style={styles.chipRow}>
                {recommendations.focus.map((f) => (
                  <View
                    key={f}
                    style={[styles.chip, { borderColor: colors.gold, backgroundColor: colors.goldSubtle }]}
                  >
                    <Text style={[styles.chipText, { color: colors.gold }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {recommendations.ready_to_train.length > 0 && (
            <View style={styles.recSection}>
              <Text style={styles.recLabel}>Ready to Train</Text>
              <View style={styles.chipRow}>
                {recommendations.ready_to_train.map((m) => (
                  <View
                    key={m}
                    style={[styles.chip, { borderColor: colors.success, backgroundColor: colors.successSubtle }]}
                  >
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
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pct: {
    fontSize: 13,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.3,
    color: colors.text,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
});

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.borderAccent,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primarySubtle,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 2.4,
    color: colors.primaryLight,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
    letterSpacing: 0,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  balanceValue: {
    fontSize: 40,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -1.2,
    color: colors.text,
    lineHeight: 44,
  },
  balanceOutOf: {
    fontSize: 13,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
  balanceBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  balanceBarFill: {
    height: '100%',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  recSection: {
    marginBottom: spacing.sm,
  },
  recLabel: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    fontFamily: typography.fontSerif,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: { textAlign: 'center', lineHeight: 22 },
});
