/**
 * ChallengeCard — list card for a single challenge (CHAL-01 / CHAL-03).
 *
 * Layout:
 *   Row 1: type emoji icon + type badge chip + countdown chip (right-aligned)
 *   Row 2: title (heading) + description (2-line, secondary)
 *   Row 3: progress bar + score labels (only when is_joined && top_score > 0)
 *   Footer: "Joined" chip (joined) OR participant count (not joined, active)
 *
 * Tokens: colors from src/theme/colors.ts, typography from src/theme/typography.ts.
 * No inline hex values — DOC_03 token palette only.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import type { ChallengeListItem } from '@nexera/types';
import type { WeightUnit } from '@nexera/types';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  challengeIcon,
  countdownLabel,
  formatScore,
  progressPct,
} from '../../lib/challengeLogic';

interface ChallengeCardProps {
  challenge: ChallengeListItem;
  weightUnit: WeightUnit;
  onPress: () => void;
}

/** Capitalise the first letter of a challenge type for display. */
function typeLabel(type: string): string {
  const map: Record<string, string> = {
    volume: 'Volume',
    sessions: 'Sessions',
    pr: 'PR',
    streak: 'Streak',
    machine_explorer: 'Explorer',
    team: 'Team',
    custom: 'Custom',
  };
  return map[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function ChallengeCard({ challenge, weightUnit, onPress }: ChallengeCardProps) {
  const now = new Date();
  const countdown = countdownLabel(challenge.end_date, now);
  const isEnded = countdown === 'Ended';
  const showProgress =
    challenge.is_joined &&
    challenge.top_score > 0 &&
    challenge.my_score !== null;

  const pct = showProgress ? progressPct(challenge.my_score, challenge.top_score) : 0;
  const myScoreLabel = showProgress
    ? formatScore(challenge.my_score as number, challenge.challenge_type, weightUnit)
    : '';
  const topScoreLabel = showProgress
    ? formatScore(challenge.top_score, challenge.challenge_type, weightUnit)
    : '';

  const a11yLabel = `${challenge.title}. ${typeLabel(challenge.challenge_type)} challenge. ${countdown}.${challenge.is_joined ? ' Joined.' : ''}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {/* Row 1: icon + type badge + countdown */}
      <View style={styles.row1}>
        <View style={styles.row1Left}>
          <Text style={styles.typeEmoji}>
            {challengeIcon(challenge.challenge_type)}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {typeLabel(challenge.challenge_type)}
            </Text>
          </View>
        </View>
        <View style={[styles.countdownChip, isEnded && styles.countdownChipEnded]}>
          <Text style={[styles.countdownText, isEnded && styles.countdownTextEnded]}>
            {countdown}
          </Text>
        </View>
      </View>

      {/* Row 2: title + description */}
      <View style={styles.row2}>
        <Text style={styles.title} numberOfLines={1}>
          {challenge.title}
        </Text>
        {challenge.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {challenge.description}
          </Text>
        ) : null}
      </View>

      {/* Row 3: progress bar (joined challenges with scores only) */}
      {showProgress ? (
        <View style={styles.row3}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>
            You: {myScoreLabel} · Leader: {topScoreLabel}
          </Text>
        </View>
      ) : null}

      {/* Footer: joined chip or participant count */}
      <View style={styles.footer}>
        {challenge.is_joined ? (
          <View style={styles.joinedChip}>
            <Text style={styles.joinedChipText}>Joined</Text>
          </View>
        ) : challenge.is_active && challenge.total_participants > 0 ? (
          <Text style={styles.participantCount}>
            {challenge.total_participants} competing
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },

  // Row 1 — type badge + countdown
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row1Left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  typeBadge: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  typeBadgeText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  countdownChip: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownChipEnded: {
    backgroundColor: colors.bgSkeleton,
    borderColor: colors.borderSubtle,
  },
  countdownText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMedium,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  countdownTextEnded: {
    color: colors.textSecondary,
  },

  // Row 2 — title + description
  row2: {
    gap: 4,
  },
  title: {
    fontSize: typography.bodyLgSize,
    fontFamily: typography.fontBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: typography.smallSize * typography.smallLeading,
  },

  // Row 3 — progress bar
  row3: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  joinedChip: {
    backgroundColor: colors.successSubtle,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.25)',
  },
  joinedChipText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontSemiBold,
    color: colors.success,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  participantCount: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMedium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});
