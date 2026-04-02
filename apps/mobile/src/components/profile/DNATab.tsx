import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { Card } from '../Card';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ARCHETYPES, DIMENSION_CONFIG, DNA_AXES } from '@nexera/ai-assist';
import type { DNACacheResult } from '../../lib/memberData';

interface DNATabProps {
  dna: DNACacheResult | null;
}

const DIMENSION_COLORS: Record<string, string> = {
  power: colors.error,
  consistency: colors.primary,
  progression: colors.success,
  balance: colors.gold,
  mindset: colors.purple,
};

function PentagonChart({ scores }: { scores: Record<string, number> }) {
  const size = 200;
  const center = size / 2;
  const radius = 80;

  // Calculate pentagon vertices (5 axes, starting from top)
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Build ring paths for 25, 50, 75, 100
  const rings = [25, 50, 75, 100];

  return (
    <View style={pentStyles.container}>
      {/* Using View-based approach since SVG may not be available */}
      <View style={[pentStyles.chart, { width: size, height: size }]}>
        {/* Center dot */}
        <View style={[pentStyles.centerDot, { left: center - 2, top: center - 2 }]} />

        {/* Axis labels */}
        {DNA_AXES.map((axis, i) => {
          const pt = getPoint(i, 115);
          return (
            <Text
              key={axis.key}
              style={[
                pentStyles.axisLabel,
                {
                  left: pt.x - 25,
                  top: pt.y - 8,
                  color: DIMENSION_COLORS[axis.key] ?? colors.textSecondary,
                },
              ]}
            >
              {axis.icon} {scores[axis.key] ?? 0}
            </Text>
          );
        })}

        {/* Score dots on axes */}
        {DNA_AXES.map((axis, i) => {
          const pt = getPoint(i, scores[axis.key] ?? 0);
          return (
            <View
              key={`dot-${axis.key}`}
              style={[
                pentStyles.scoreDot,
                {
                  left: pt.x - 4,
                  top: pt.y - 4,
                  backgroundColor: DIMENSION_COLORS[axis.key] ?? colors.primary,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function ScoreBar({ label, score, color, icon }: { label: string; score: number; color: string; icon: string }) {
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.icon}>{icon}</Text>
      <View style={barStyles.info}>
        <View style={barStyles.labelRow}>
          <Text variant="body" style={barStyles.label}>{label}</Text>
          <Text variant="caption" style={[barStyles.score, { color }]}>{score}</Text>
        </View>
        <View style={barStyles.barBg}>
          <View style={[barStyles.barFill, { width: `${score}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

export function DNATab({ dna }: DNATabProps) {
  if (!dna) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'🧬'}</Text>
        <Text variant="heading" style={styles.emptyTitle}>Performance DNA</Text>
        <Text variant="body" color="textSecondary" style={styles.emptyText}>
          Complete at least 10 sessions to unlock your Performance DNA profile.
        </Text>
      </View>
    );
  }

  if (dna.is_building) {
    const progress = Math.min(100, Math.round((dna.session_count / 10) * 100));
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'🧬'}</Text>
        <Text variant="heading" style={styles.emptyTitle}>Building Your DNA</Text>
        <Text variant="body" color="textSecondary" style={styles.emptyText}>
          {dna.session_count}/10 sessions completed. Keep training to unlock your full profile.
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>
    );
  }

  const archetype = ARCHETYPES[dna.archetype_key];
  const scores: Record<string, number> = {
    power: dna.power,
    consistency: dna.consistency,
    progression: dna.progression,
    balance: dna.balance,
    mindset: dna.mindset,
  };

  return (
    <View>
      {/* Pentagon Radar */}
      <AnimatedCard index={0} style={styles.card}>
        <PentagonChart scores={scores} />
      </AnimatedCard>

      {/* Archetype Badge */}
      {archetype && (
        <AnimatedCard index={1} style={styles.card}>
          <View style={[styles.archetypeCard, { borderLeftColor: dna.archetype_color || colors.primary }]}>
            <Text style={styles.archetypeIcon}>{dna.archetype_icon}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="heading" style={styles.archetypeName}>
                {dna.archetype_name}
              </Text>
              <Text variant="caption" color="textSecondary">
                {archetype.description}
              </Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Score Breakdown */}
      <AnimatedCard index={2} style={styles.card}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
          Score Breakdown
        </Text>
        {DNA_AXES.map((axis) => {
          const config = DIMENSION_CONFIG[axis.key];
          return (
            <ScoreBar
              key={axis.key}
              label={config?.label ?? axis.key}
              score={scores[axis.key] ?? 0}
              color={DIMENSION_COLORS[axis.key] ?? colors.primary}
              icon={axis.icon}
            />
          );
        })}
      </AnimatedCard>
    </View>
  );
}

const pentStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  chart: {
    position: 'relative',
  },
  centerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '600',
    width: 50,
    textAlign: 'center',
  },
  scoreDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

const barStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  icon: { fontSize: 18, width: 24 },
  info: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { fontWeight: '500', fontSize: 14 },
  score: { fontWeight: '700', fontSize: 14 },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
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
  archetypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderLeftWidth: 4,
    paddingLeft: spacing.sm,
  },
  archetypeIcon: { fontSize: 36 },
  archetypeName: { marginBottom: 4 },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
  emptyText: { textAlign: 'center', lineHeight: 22 },
  progressBarBg: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.purple,
  },
});
