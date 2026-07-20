/**
 * ProgramHeader — displays program name, goal, meta chips, and week progress bar.
 *
 * Used by app/program/index.tsx (PROG-01).
 * All design tokens from src/theme/* — zero hardcoded hex.
 */
import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  buildMetaChips,
  weekLabel,
  programProgressPct,
} from '../../lib/programLogic';
import type { ActiveProgram } from '../../lib/programService';

interface ProgramHeaderProps {
  program: ActiveProgram;
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` as `${number}%` }]} />
    </View>
  );
}

export function ProgramHeader({ program }: ProgramHeaderProps) {
  const chips = buildMetaChips({
    goal: program.goal,
    duration_weeks: program.duration_weeks,
    sessions_per_week: program.sessions_per_week,
    trainer_name: program.trainer_name,
  });
  const progressPct = programProgressPct(program.sessions_completed, program.sessions_total);
  const label = weekLabel(program.week_number, program.duration_weeks);

  return (
    <View style={styles.container}>
      {/* Kicker */}
      <Text style={styles.kicker}>YOUR PROGRAM</Text>

      {/* Title */}
      <Text style={styles.title}>{program.title}</Text>

      {/* Description */}
      {program.description ? (
        <Text style={styles.description}>{program.description}</Text>
      ) : null}

      {/* Meta chips */}
      <View style={styles.chipsRow}>
        {chips.map((chip) => (
          <View key={chip} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
      </View>

      {/* Week progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.weekLabel}>{label}</Text>
          <Text style={styles.sessionsLabel}>
            {program.sessions_completed}/{program.sessions_total} sessions
          </Text>
        </View>
        <ProgressBar pct={progressPct} />
        {program.on_track === false ? (
          <Text style={styles.catchingUp}>Catching up</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  kicker: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.h3Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    lineHeight: typography.h3Size * 1.3,
  },
  description: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: typography.bodySize * 1.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  sessionsLabel: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  catchingUp: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontRegular,
    color: colors.textMuted,
  },
});
