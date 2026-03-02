import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { getLeaderboard } from '../src/lib/leaderboardService';
import { Text, Card } from '../src/components';
import { AnimatedScreen } from '../src/components/AnimatedScreen';
import { SkeletonGate, LeaderboardScreenSkeleton } from '../src/components/skeleton';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import type { LeaderboardEntry, LeaderboardPeriod } from '@smartgym/types';

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

  const renderItem = ({ item }: { item: LeaderboardEntry }) => (
    <View style={[styles.row, item.is_current_user && styles.rowHighlight]}>
      <Text style={[styles.rank, item.rank <= 3 && styles.rankTop]}>
        {item.rank <= 3 ? ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][item.rank] : `#${item.rank}`}
      </Text>
      <View style={[styles.avatar, item.is_current_user && styles.avatarHighlight]}>
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

  return (
    <SkeletonGate loading={loading} skeleton={<LeaderboardScreenSkeleton />}>
    <AnimatedScreen>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <Text variant="heading" style={styles.title}>Leaderboard</Text>
        </View>

        {/* Period Toggle */}
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

        {error && (
          <View style={styles.errorBanner}>
            <Text variant="caption" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        <FlatList
          data={entries}
          keyExtractor={(item) => item.profile_id}
          renderItem={renderItem}
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
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
  },
  title: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHighlight: {
    backgroundColor: '#edf2ff',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  rank: {
    width: 36,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rankTop: {
    fontSize: 22,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarHighlight: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  nameHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3a0ca3',
  },
  pointsHighlight: {
    color: colors.primary,
  },
  errorBanner: {
    backgroundColor: '#fce4e6',
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
});
