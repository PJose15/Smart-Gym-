import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { LevelProgress } from '@nexera/ai-assist';

interface ProfileHeaderProps {
  fullName: string | null;
  email: string;
  memberSince: string | null;
  levelProgress: LevelProgress | null;
  streak: number;
  totalSessions: number;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0]?.toUpperCase() || '?';
}

export function ProfileHeader({
  fullName,
  email,
  memberSince,
  levelProgress,
  streak,
  totalSessions,
}: ProfileHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => router.push('/settings' as any)}
          accessibilityLabel="Settings"
        >
          <Text style={styles.gearIcon}>{'⚙'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
      </View>

      <Text variant="heading" style={styles.name}>
        {fullName || 'No Name Set'}
      </Text>
      <Text variant="body" color="textSecondary">{email}</Text>

      {memberSince && (
        <Text variant="caption" color="textSecondary" style={styles.memberSince}>
          Member since {new Date(memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      )}

      {levelProgress && (
        <View style={styles.levelRow}>
          <View style={[styles.levelBadge, { backgroundColor: levelProgress.current.color + '20' }]}>
            <Text style={[styles.levelBadgeText, { color: levelProgress.current.color }]}>
              Lv. {levelProgress.current.level}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary" style={styles.levelName}>
            {levelProgress.current.name}
          </Text>
        </View>
      )}

      {levelProgress && levelProgress.next && (
        <View style={styles.xpBarContainer}>
          <View style={styles.xpBarBg}>
            <View
              style={[
                styles.xpBarFill,
                {
                  width: `${levelProgress.progressPct}%`,
                  backgroundColor: levelProgress.current.color,
                },
              ]}
            />
          </View>
          <Text variant="caption" color="textSecondary" style={styles.xpLabel}>
            {levelProgress.pointsToNext} pts to Level {levelProgress.next.level}
          </Text>
        </View>
      )}

      <View style={styles.quickStatsRow}>
        {streak > 0 && (
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{streak}</Text>
            <Text variant="caption" color="textSecondary">streak</Text>
          </View>
        )}
        <View style={styles.quickStat}>
          <Text style={styles.quickStatValue}>{totalSessions}</Text>
          <Text variant="caption" color="textSecondary">sessions</Text>
        </View>
        {levelProgress && (
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{levelProgress.score.toLocaleString()}</Text>
            <Text variant="caption" color="textSecondary">XP</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  gearButton: {
    padding: spacing.xs,
  },
  gearIcon: {
    fontSize: 22,
    color: colors.textSecondary,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    marginBottom: spacing.xs,
  },
  memberSince: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  levelName: {
    fontWeight: '500',
  },
  xpBarContainer: {
    width: '80%',
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  xpBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
});
