import { View, StyleSheet } from 'react-native';
import Svg, {
  Polygon,
  Line,
  Circle,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Text } from '../Text';
import { AnimatedCard } from '../AnimatedCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ARCHETYPES, DIMENSION_CONFIG, DNA_AXES } from '@nexera/ai-assist';
import type { DNACacheResult } from '../../lib/memberData';

interface DNATabProps {
  dna: DNACacheResult | null;
}

// ─── Pentagon Radar (design.md §7.5 — crimson stroke + glow, grid rings, ghost) ───

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 95;
const GRID_STROKE = 'rgba(255, 255, 255, 0.09)';

function vertex(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
  const r = (value / 100) * RADIUS;
  return {
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  };
}

function ringPoints(value: number): string {
  return DNA_AXES.map((_, i) => {
    const p = vertex(i, value);
    return `${p.x},${p.y}`;
  }).join(' ');
}

// Label anchors per axis position (0 top, 1 right, 2 bottom-right, 3 bottom-left, 4 left)
const LABEL_ANCHOR: Array<'middle' | 'start' | 'end'> = ['middle', 'start', 'middle', 'middle', 'end'];
const LABEL_DY = [-8, 4, 14, 14, 4];

function PentagonChart({ scores }: { scores: Record<string, number> }) {
  const dataPoints = DNA_AXES.map((axis, i) => vertex(i, scores[axis.key] ?? 0));
  const dataPointsStr = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={pentStyles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <RadialGradient id="dnaCoreGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.22} />
            <Stop offset="70%" stopColor={colors.primary} stopOpacity={0.06} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Central crimson glow */}
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#dnaCoreGlow)" />

        {/* Grid rings (25 / 50 / 75 / 100) */}
        {[25, 50, 75, 100].map((ring) => (
          <Polygon
            key={ring}
            points={ringPoints(ring)}
            fill="none"
            stroke={GRID_STROKE}
            strokeWidth={1}
          />
        ))}

        {/* Axes */}
        {DNA_AXES.map((axis, i) => {
          const p = vertex(i, 100);
          return (
            <Line
              key={axis.key}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke={GRID_STROKE}
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon — halo pass (fake glow) + crisp pass */}
        <Polygon
          points={dataPointsStr}
          fill="none"
          stroke={colors.primary}
          strokeWidth={7}
          strokeOpacity={0.22}
          strokeLinejoin="round"
        />
        <Polygon
          points={dataPointsStr}
          fill="rgba(224, 20, 47, 0.18)"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <Circle key={DNA_AXES[i].key} cx={p.x} cy={p.y} r={3} fill={colors.white} />
        ))}

        {/* Axis labels */}
        {DNA_AXES.map((axis, i) => {
          const p = vertex(i, 118);
          return (
            <SvgText
              key={`label-${axis.key}`}
              x={p.x}
              y={p.y + LABEL_DY[i]}
              fill={colors.textSecondary}
              fontSize={10}
              fontFamily={typography.fontSemiBold}
              letterSpacing={1}
              textAnchor={LABEL_ANCHOR[i]}
            >
              {axis.label.toUpperCase()}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── Dimension breakdown row (design: card row, mono score, thin bar) ───

function ScoreRow({
  label,
  score,
  icon,
  isTop,
}: {
  label: string;
  score: number;
  icon: string;
  isTop: boolean;
}) {
  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>
          {icon}  {label}
        </Text>
        <Text style={[barStyles.score, isTop && barStyles.scoreTop]}>{score}</Text>
      </View>
      <View style={barStyles.barBg}>
        <View
          style={[
            barStyles.barFill,
            {
              width: `${score}%`,
              backgroundColor: isTop ? colors.primary : colors.textMuted,
            },
            isTop && barStyles.barFillGlow,
          ]}
        />
      </View>
    </View>
  );
}

export function DNATab({ dna }: DNATabProps) {
  if (!dna) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{'🧬'}</Text>
        <Text style={styles.emptyTitle}>Performance DNA</Text>
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
        <Text style={styles.emptyTitle}>Building Your DNA</Text>
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
  const topKey = DNA_AXES.reduce(
    (best, axis) => ((scores[axis.key] ?? 0) > (scores[best] ?? 0) ? axis.key : best),
    DNA_AXES[0].key as string,
  );

  return (
    <View>
      {/* Radar hero card — archetype header + pentagon (design: performance-dna) */}
      <AnimatedCard index={0} style={styles.heroCard}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <Text style={styles.archetypeKicker}>ARCHETYPE</Text>
        <Text style={styles.archetypeName}>
          {dna.archetype_icon}  {dna.archetype_name}
        </Text>
        {archetype && (
          <Text variant="caption" color="textSecondary" style={styles.archetypeBlurb}>
            {archetype.description}
          </Text>
        )}
        <PentagonChart scores={scores} />
      </AnimatedCard>

      {/* Dimensional Breakdown */}
      <AnimatedCard index={1} style={styles.card}>
        <Text style={styles.sectionTitle}>DIMENSIONAL BREAKDOWN</Text>
        {DNA_AXES.map((axis) => {
          const config = DIMENSION_CONFIG[axis.key];
          return (
            <ScoreRow
              key={axis.key}
              label={config?.label ?? axis.key}
              score={scores[axis.key] ?? 0}
              icon={axis.icon}
              isTop={axis.key === topKey}
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
    paddingVertical: spacing.sm,
  },
});

const barStyles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  score: {
    fontSize: 20,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
    color: colors.text,
    lineHeight: 22,
  },
  scoreTop: {
    color: colors.primaryLight,
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
  },
  barFillGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
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
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
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
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  archetypeKicker: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 2.4,
    color: colors.primaryLight,
    marginBottom: spacing.xs,
  },
  archetypeName: {
    fontFamily: typography.fontSerif,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  archetypeBlurb: {
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.sm,
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
  progressBarBg: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
