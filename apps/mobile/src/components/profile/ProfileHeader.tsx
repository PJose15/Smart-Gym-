import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { LevelProgress } from '@nexera/ai-assist';

interface ProfileHeaderProps {
  fullName: string | null;
  email: string;
  memberSince: string | null;
  levelProgress: LevelProgress | null;
  streak: number;
  totalSessions: number;
  avatarUrl?: string | null;
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
  avatarUrl,
}: ProfileHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top bar: serif wordmark (brand moment) + settings */}
      <View style={styles.topRow}>
        <Text style={styles.wordmark}>NEXTERA</Text>
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => router.push('/settings' as any)}
          accessibilityLabel="Settings"
        >
          <Text style={styles.gearIcon}>{'⚙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Identity card — L2 surface, hairline border, corner crimson glow */}
      <View style={styles.card}>
        <View style={styles.cornerGlow} pointerEvents="none" />

        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
            )}
          </View>
        </View>

        <Text style={styles.name}>{fullName || 'No Name Set'}</Text>
        <Text variant="caption" color="textSecondary" style={styles.email}>{email}</Text>

        {levelProgress && (
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>
              LEVEL <Text style={styles.levelNumber}>{levelProgress.current.level}</Text>
            </Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.xpValue}>{levelProgress.score.toLocaleString()} XP</Text>
          </View>
        )}

        {levelProgress && (
          <Text variant="caption" color="textSecondary" style={styles.levelName}>
            {levelProgress.current.name}
          </Text>
        )}

        {memberSince && (
          <Text style={styles.memberSince}>
            Member since {new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
        )}

        {levelProgress && levelProgress.next && (
          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarLabels}>
              <Text style={styles.xpToNext}>
                {levelProgress.pointsToNext.toLocaleString()} XP TO LEVEL {levelProgress.next.level}
              </Text>
              <Text style={styles.xpNextLevel}>LEVEL {levelProgress.next.level}</Text>
            </View>
            <View style={styles.xpBarBg}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${levelProgress.progressPct}%` },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.quickStatsRow}>
          {streak > 0 && (
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{streak}</Text>
              <Text style={styles.quickStatLabel}>🔥 STREAK</Text>
            </View>
          )}
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{totalSessions}</Text>
            <Text style={styles.quickStatLabel}>SESSIONS</Text>
          </View>
          {levelProgress && (
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{levelProgress.score.toLocaleString()}</Text>
              <Text style={styles.quickStatLabel}>XP</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  wordmark: {
    fontFamily: typography.fontSerif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.text,
    textTransform: 'uppercase',
  },
  gearButton: {
    padding: spacing.xs,
  },
  gearIcon: {
    fontSize: 22,
    color: colors.textSecondary,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cornerGlow: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primarySubtle,
  },
  avatarWrap: {
    // Crimson halo behind the avatar (glow, not drop shadow)
    borderRadius: 46,
    padding: 4,
    backgroundColor: colors.primarySubtle,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: colors.text,
    fontSize: 28,
    fontFamily: typography.fontSerifBold,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  name: {
    fontFamily: typography.fontSerif,
    fontSize: 28,
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  email: {
    marginBottom: spacing.sm,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  levelLabel: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    color: colors.primaryLight,
  },
  levelNumber: {
    fontFamily: typography.fontMonoBold,
    fontSize: 13,
    color: colors.primaryLight,
  },
  dotSeparator: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  xpValue: {
    fontFamily: typography.fontMonoBold,
    fontSize: 14,
    color: colors.text,
    letterSpacing: -0.3,
  },
  levelName: {
    marginTop: 2,
  },
  memberSince: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textMuted,
  },
  xpBarContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  xpBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpToNext: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.8,
    color: colors.primaryLight,
  },
  xpNextLevel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  xpBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  quickStatsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 22,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
    color: colors.text,
  },
  quickStatLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
