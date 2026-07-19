import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../src/lib/supabase';
import { getLeaderboard } from '../src/lib/leaderboardService';
import { Text } from '../src/components';
import { AnimatedScreen } from '../src/components/AnimatedScreen';
import { SkeletonGate, LeaderboardScreenSkeleton } from '../src/components/skeleton';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import type { LeaderboardEntry, LeaderboardPeriod } from '@nexera/types';

// Medal ring colors for the top-3 rank badges (design: gold w/ glow, silver, bronze)
const MEDAL_COLORS: Record<number, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (selectedPeriod: LeaderboardPeriod) => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('gym_members')
        .select('gym_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!memberData?.gym_id) return;

      const data = await getLeaderboard(memberData.gym_id, user.id, selectedPeriod);
      setEntries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard(period);
  }, [period, loadLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard(period);
    setRefreshing(false);
  }, [period, loadLeaderboard]);

  const handlePeriodToggle = (newPeriod: LeaderboardPeriod) => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    setLoading(true);
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const medal = MEDAL_COLORS[item.rank];
    return (
      <View style={[styles.row, item.is_current_user && styles.rowHighlight]}>
        {medal ? (
          <View
            style={[
              styles.rankBadge,
              { borderColor: medal },
              item.rank === 1 && styles.rankBadgeGold,
            ]}
          >
            <Text style={[styles.rankBadgeText, { color: medal }]}>{item.rank}</Text>
          </View>
        ) : (
          <Text style={[styles.rank, item.is_current_user && styles.rankHighlight]}>
            {item.rank}
          </Text>
        )}
        <View
          style={[
            styles.avatar,
            medal ? { borderColor: medal } : null,
            item.is_current_user && styles.avatarHighlight,
          ]}
        >
          <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Text variant="body" style={[styles.name, item.is_current_user && styles.nameHighlight]}>
            {item.is_current_user ? 'You' : item.full_name}
          </Text>
        </View>
        <Text style={[styles.points, item.is_current_user && styles.pointsHighlight]}>
          {item.total_points.toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <SkeletonGate loading={loading} skeleton={<LeaderboardScreenSkeleton />}>
    <AnimatedScreen>
      <View style={styles.container}>
        {/* Serif brand wordmark header (design: leaderboard.png) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text variant="body" color="primary" style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.wordmark}>NEXERA</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Period Toggle — pill chips per design system (4px/pill chips) */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleOption, period === 'weekly' && styles.toggleActive]}
            onPress={() => handlePeriodToggle('weekly')}
          >
            <Text style={[styles.toggleText, period === 'weekly' && styles.toggleTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, period === 'all_time' && styles.toggleActive]}
            onPress={() => handlePeriodToggle('all_time')}
          >
            <Text style={[styles.toggleText, period === 'all_time' && styles.toggleTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Enrichment: Your Position + Stats */}
        {entries.length > 0 && (() => {
          const currentUser = entries.find(e => e.is_current_user);
          const leader = entries[0];
          const aboveUser = currentUser && currentUser.rank > 1
            ? entries.find(e => e.rank === currentUser.rank - 1)
            : null;
          const gapToNext = aboveUser && currentUser
            ? aboveUser.total_points - currentUser.total_points
            : null;
          const gapToFirst = currentUser && leader && currentUser.rank > 1
            ? leader.total_points - currentUser.total_points
            : null;
          return (
            <>
              <View style={styles.positionCard}>
                <LinearGradient
                  colors={[colors.primaryLight, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.energyRibbon}
                />
                <View style={styles.positionRow}>
                  <View style={styles.positionStat}>
                    <Text variant="body" style={styles.positionRank}>
                      #{currentUser?.rank ?? '-'}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={styles.positionLabel}>Your Rank</Text>
                  </View>
                  <View style={styles.positionStat}>
                    <Text variant="body" style={styles.positionPoints}>
                      {currentUser?.total_points.toLocaleString() ?? '0'}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={styles.positionLabel}>Points</Text>
                  </View>
                  {gapToNext !== null && gapToNext > 0 && (
                    <View style={styles.positionStat}>
                      <Text variant="body" style={styles.positionGap}>
                        {gapToNext.toLocaleString()}
                      </Text>
                      <Text variant="caption" color="textSecondary" style={styles.positionLabel}>To Next</Text>
                    </View>
                  )}
                </View>
                {gapToFirst !== null && gapToFirst > 0 && (
                  <Text variant="caption" color="textSecondary" style={styles.gapToLeaderText}>
                    {gapToFirst.toLocaleString()} points behind the leader
                  </Text>
                )}
              </View>
              <Text variant="caption" color="textSecondary" style={styles.participantCount}>
                {entries.length} member{entries.length !== 1 ? 's' : ''} competing
              </Text>
            </>
          );
        })()}

        {/* Kicker label above the ranked list (design: "THIS WEEK ▾") */}
        {entries.length > 0 && (
          <Text style={styles.listKicker}>
            {period === 'weekly' ? 'THIS WEEK' : 'ALL TIME'}
          </Text>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text variant="caption" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        <FlatList
          data={entries}
          keyExtractor={(item) => item.profile_id}
          renderItem={renderItem}
          maxToRenderPerBatch={15}
          windowSize={5}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
                No points recorded yet. Complete workouts to earn points!
              </Text>
            </View>
          }
        />
      </View>
    </AnimatedScreen>
    </SkeletonGate>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    minWidth: 48,
  },
  backText: {
    fontFamily: typography.fontSemiBold,
  },
  headerSpacer: {
    minWidth: 48,
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontSerifBold,
    fontSize: 24,
    letterSpacing: 6,
    color: colors.text,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.primaryLight,
  },
  listKicker: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHighlight: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  rank: {
    width: 32,
    fontSize: 15,
    fontFamily: typography.fontMonoBold,
    color: colors.textMuted,
    textAlign: 'center',
    marginRight: spacing.sm,
  },
  rankHighlight: {
    color: colors.primaryLight,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  rankBadgeGold: {
    backgroundColor: colors.goldSubtle,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  rankBadgeText: {
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarHighlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.fontBold,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontFamily: typography.fontSemiBold,
  },
  nameHighlight: {
    color: colors.primaryLight,
    fontFamily: typography.fontBold,
  },
  points: {
    fontSize: 16,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
  },
  pointsHighlight: {
    color: colors.primaryLight,
  },
  errorBanner: {
    backgroundColor: colors.errorSubtle,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },

  // ─── Your Position Card (featured: Energy Ribbon top accent) ───
  positionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: spacing.md,
    paddingTop: spacing.md + 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  energyRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  positionStat: {
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  positionRank: {
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
    marginBottom: 2,
  },
  positionPoints: {
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
    marginBottom: 2,
  },
  positionGap: {
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    color: colors.gold,
    marginBottom: 2,
  },
  gapToLeaderText: {
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 12,
  },
  participantCount: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: 12,
  },
});
