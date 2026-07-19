/**
 * ChallengeLeaderboard — ranked participant list with medal badges and
 * a pinned "YOU" row when the current member is outside the visible top-N.
 *
 * Renders inside a parent ScrollView as a plain View list (no nested
 * FlatList / VirtualizedList) to avoid the nested-virtualised-list warning.
 *
 * Medal colours: gold/silver/bronze from colors.ts gamification tokens.
 * "You" row highlight: colors.infoSubtle bg + colors.info accent border.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChallengeParticipant, ChallengeType, WeightUnit } from '@nexera/types';
import { buildLeaderboardRows, formatScore } from '../../lib/challengeLogic';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChallengeLeaderboardProps {
  participants: ChallengeParticipant[];
  myMemberId: string;
  challengeType: ChallengeType;
  weightUnit: WeightUnit;
}

// ─── Medal rank badges ────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<number, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

// ─── Avatar (initial-letter circle fallback) ──────────────────────────────────

function AvatarCircle({
  name,
  avatarUrl,
  isMe,
}: {
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
}) {
  // avatarUrl support omitted — React Native Image requires uri objects; for
  // consistency with the feed avatar handling, we use the initial-letter
  // fallback (same approach used by FeedEventCard when avatar_url is null).
  const initial = name.charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.avatarCircle,
        isMe && { borderColor: colors.info, borderWidth: 2 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

// ─── Single leaderboard row ───────────────────────────────────────────────────

function LeaderboardRow({
  participant,
  isMe,
  challengeType,
  weightUnit,
}: {
  participant: ChallengeParticipant;
  isMe: boolean;
  challengeType: ChallengeType;
  weightUnit: WeightUnit;
}) {
  const rank = participant.current_rank;
  const medalColor = MEDAL_COLORS[rank];
  const scoreText = formatScore(participant.current_score, challengeType, weightUnit);
  const displayName = isMe ? `${participant.display_name} (You)` : participant.display_name;

  const accessibilityLabel = `Rank ${rank}, ${participant.display_name}, ${scoreText}${isMe ? ', your row' : ''}`;

  return (
    <View
      style={[styles.row, isMe && styles.rowMe]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {/* Rank badge */}
      <View
        style={[
          styles.rankBadge,
          medalColor ? { backgroundColor: medalColor + '22', borderColor: medalColor } : styles.rankBadgePlain,
        ]}
      >
        <Text
          style={[
            styles.rankText,
            medalColor ? { color: medalColor } : { color: colors.textSecondary },
          ]}
        >
          {rank}
        </Text>
      </View>

      {/* Avatar */}
      <AvatarCircle
        name={participant.display_name}
        avatarUrl={participant.avatar_url}
        isMe={isMe}
      />

      {/* Name */}
      <Text
        style={[styles.name, isMe && styles.nameMe]}
        numberOfLines={1}
      >
        {displayName}
      </Text>

      {/* Score */}
      <Text style={styles.score}>{scoreText}</Text>
    </View>
  );
}

// ─── Pinned divider ───────────────────────────────────────────────────────────

function PinnedDivider() {
  return (
    <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>Your rank</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChallengeLeaderboard({
  participants,
  myMemberId,
  challengeType,
  weightUnit,
}: ChallengeLeaderboardProps) {
  const { top, pinnedMe } = buildLeaderboardRows(participants, myMemberId, 10);

  if (participants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No participants yet — be the first to join
        </Text>
      </View>
    );
  }

  return (
    <View>
      {top.map((p) => (
        <LeaderboardRow
          key={p.member_id}
          participant={p}
          isMe={p.member_id === myMemberId}
          challengeType={challengeType}
          weightUnit={weightUnit}
        />
      ))}

      {pinnedMe !== null && (
        <>
          <PinnedDivider />
          <LeaderboardRow
            participant={pinnedMe}
            isMe
            challengeType={challengeType}
            weightUnit={weightUnit}
          />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.smallSize,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'transparent',
    gap: spacing.sm,
  },
  rowMe: {
    backgroundColor: colors.infoSubtle,
    borderWidth: 1,
    borderColor: colors.info + '55',
  },

  // Rank badge
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankBadgePlain: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  rankText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontBold,
  },

  // Avatar circle
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarInitial: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontBold,
    color: colors.textSecondary,
  },

  // Name + score
  name: {
    flex: 1,
    fontSize: typography.bodySize,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
  nameMe: {
    color: colors.info,
    fontFamily: typography.fontSemiBold,
  },
  score: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
    flexShrink: 0,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMedium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
