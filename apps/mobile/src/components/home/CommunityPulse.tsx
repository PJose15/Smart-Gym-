/**
 * CommunityPulse — Gym feed highlights. Based on DOC_07 Part 2F.
 * Shows 2-3 recent gym events (PRs, level-ups, challenges).
 */
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

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

      <View style={styles.items}>
        {rank ? (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcon}>{'\uD83C\uDFC6'}</Text>
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
          >
            <Text style={styles.itemIcon}>{'\uD83C\uDFC6'}</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Leaderboard</Text>
              <Text style={styles.itemAction}>See how you compare →</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {recentBadgeName && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcon}>{recentBadgeIcon || '\uD83C\uDFC5'}</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Badge Unlocked!</Text>
              <Text style={styles.itemSub}>{recentBadgeName}</Text>
            </View>
          </TouchableOpacity>
        )}

        {coachNotesCount > 0 && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push('/coach-notes')}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcon}>{'\uD83D\uDCDD'}</Text>
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  items: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  itemIcon: {
    fontSize: 24,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemAction: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
});
