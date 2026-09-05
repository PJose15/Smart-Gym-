/**
 * CommunityPulse — Gym feed highlights. Based on DOC_07 Part 2F.
 * Shows 2-3 recent gym events (PRs, level-ups, challenges).
 * Restyled to the NEXTERA Red-Luxury system: one L2 card (22px radius,
 * hairline border) with hairline-separated rows, crimson action links.
 */
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface CommunityPulseProps {
  rank?: { rank: number; total: number } | null;
  recentBadgeIcon?: string;
  recentBadgeName?: string;
  coachNotesCount: number;
  leaderboardEnabled?: boolean;
}

export function CommunityPulse({ rank, recentBadgeIcon, recentBadgeName, coachNotesCount, leaderboardEnabled }: CommunityPulseProps) {
  const router = useRouter();
  const hasContent = rank || recentBadgeName || coachNotesCount > 0 || leaderboardEnabled;

  if (!hasContent) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Activity</Text>

      <View style={styles.card}>
        {rank ? (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Leaderboard: ranked ${rank.rank} of ${rank.total} this week`}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.itemIcon}>{'🏆'}</Text>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                #{rank.rank} of {rank.total} this week
              </Text>
              <Text style={styles.itemAction}>View Leaderboard →</Text>
            </View>
          </TouchableOpacity>
        ) : leaderboardEnabled ? (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open leaderboard"
          >
            <View style={styles.iconCircle}>
              <Text style={styles.itemIcon}>{'🏆'}</Text>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Leaderboard</Text>
              <Text style={styles.itemAction}>See how you compare →</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {recentBadgeName && (
          <TouchableOpacity
            style={[styles.item, (rank || leaderboardEnabled) && styles.itemBordered]}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Badge unlocked: ${recentBadgeName}. View profile`}
          >
            <View style={[styles.iconCircle, styles.iconCircleGold]}>
              <Text style={styles.itemIcon}>{recentBadgeIcon || '🏅'}</Text>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Badge Unlocked!</Text>
              <Text style={styles.itemSub}>{recentBadgeName}</Text>
            </View>
          </TouchableOpacity>
        )}

        {coachNotesCount > 0 && (
          <TouchableOpacity
            style={[
              styles.item,
              (rank || leaderboardEnabled || recentBadgeName) && styles.itemBordered,
            ]}
            onPress={() => router.push('/coach-notes')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open coach notes"
          >
            <View style={styles.iconCircle}>
              <Text style={styles.itemIcon}>{'📝'}</Text>
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Coach Notes</Text>
              <Text style={styles.itemSub}>
                {coachNotesCount} note{coachNotesCount !== 1 ? 's' : ''} from your trainer
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  itemBordered: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGold: {
    backgroundColor: colors.goldSubtle,
    borderColor: 'rgba(232, 179, 57, 0.35)',
  },
  itemIcon: {
    fontSize: 18,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemAction: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    color: colors.primary,
    marginTop: 2,
  },
});
