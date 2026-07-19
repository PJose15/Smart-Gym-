/**
 * FeedEventCard — one gym feed event (DOC_05 §5, adapted to the real schema).
 *
 * Contract (matches web FeedEventCard): the bold member name is rendered as
 * its own span and the description NEVER repeats it — `formatFeedEventText`
 * rebuilds numeric descriptions in the viewer's weight unit and strips any
 * legacy baked-in name prefix.
 */
import { memo, useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity, View, Text as RNText } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FeedEventFull, ReactionType, WeightUnit } from '@nexera/types';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { eventIcon, formatFeedEventText, timeAgo } from '../../lib/feedLogic';
import { ReactionBar } from './ReactionBar';

interface FeedEventCardProps {
  event: FeedEventFull;
  currentMemberId: string;
  weightUnit: WeightUnit;
  isFollowing: boolean;
  onToggleReaction: (eventId: string, type: ReactionType) => void;
  onOpenComments: (eventId: string) => void;
  onToggleFollow: (memberId: string, isFollowing: boolean) => void;
}

function FeedEventCardInner({
  event,
  currentMemberId,
  weightUnit,
  isFollowing,
  onToggleReaction,
  onOpenComments,
  onToggleFollow,
}: FeedEventCardProps) {
  const isOwnEvent = event.member_id === currentMemberId;
  const icon = eventIcon(event.event_type);
  const description = useMemo(
    () => formatFeedEventText(event, weightUnit),
    [event, weightUnit],
  );
  // Featured moments (pinned + PRs) get the energy-ribbon top accent
  const showRibbon =
    event.is_pinned || event.event_type === 'pr_weight' || event.event_type === 'pr_volume';

  return (
    <View style={[styles.card, event.is_pinned && styles.cardPinned]}>
      {showRibbon && (
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ribbon}
        />
      )}
      <View style={styles.row}>
        {/* Avatar or event icon */}
        {event.avatar_url ? (
          <Image source={{ uri: event.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
        )}

        <View style={styles.content}>
          {event.is_pinned && <Text style={styles.pinnedLabel}>PINNED</Text>}

          {/* Name + description in one flowing line (web parity) */}
          <RNText style={styles.description}>
            <RNText style={styles.memberName}>{event.member_name}</RNText>
            {' '}
            {description}
          </RNText>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{timeAgo(event.created_at)}</Text>
            <TouchableOpacity
              onPress={() => onOpenComments(event.id)}
              accessibilityRole="button"
              accessibilityLabel={
                event.comment_count > 0
                  ? `View ${event.comment_count} comments`
                  : 'Add a comment'
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.metaAction}>
                {event.comment_count > 0 ? `${event.comment_count} comments` : 'Comment'}
              </Text>
            </TouchableOpacity>
            {!isOwnEvent && event.member_id != null && (
              <TouchableOpacity
                onPress={() => onToggleFollow(event.member_id as string, isFollowing)}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing
                    ? `Unfollow ${event.member_name}`
                    : `Follow ${event.member_name}`
                }
                accessibilityState={{ selected: isFollowing }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.metaAction, isFollowing && styles.followingText]}>
                  {isFollowing ? 'Following ✓' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ReactionBar
            reactions={event.reactions}
            myReactions={event.my_reactions}
            onToggle={(type) => onToggleReaction(event.id, type)}
          />
        </View>
      </View>
    </View>
  );
}

/** Memoized — only re-renders when interactive state changes. */
export const FeedEventCard = memo(
  FeedEventCardInner,
  (prev, next) =>
    prev.event === next.event &&
    prev.isFollowing === next.isFollowing &&
    prev.weightUnit === next.weightUnit &&
    prev.currentMemberId === next.currentMemberId,
);

const styles = StyleSheet.create({
  // L2 card, 22px radius, hairline border — depth via tonal layers, no shadow
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    overflow: 'hidden',
  },
  cardPinned: {
    borderColor: colors.borderAccent,
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  pinnedLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  description: {
    fontSize: typography.bodySize - 1,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  memberName: {
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMono,
    color: colors.textMuted,
  },
  metaAction: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontMedium,
    color: colors.textMuted,
  },
  followingText: {
    color: colors.primary,
  },
});
