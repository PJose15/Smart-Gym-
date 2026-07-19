/**
 * Challenges tab — browse active and completed gym challenges (CHAL-01 / CHAL-03).
 *
 * State machine: LOADING → (EMPTY | ERROR | SUCCESS) with REFRESHING sub-state.
 *
 * Data layer:
 *  - fetchFeedContext() for memberId + gymId (reuses feedService — no separate auth call)
 *  - cacheFirst with key `challenges:${gymId}` (CacheTTL.challengesList = 5 min)
 *  - weightUnit from AsyncStorage via getWeightUnit()
 *
 * UI:
 *  - Active / Completed segmented toggle
 *  - FlatList of ChallengeCard → router.push(/challenges/[id]) on tap
 *  - Pull-to-refresh bypasses cache, updates store
 *  - ChallengesScreenSkeleton on first load (never a blank screen)
 *  - Empty states + retryable error state
 *  - useReducedMotion respected — list items skip animation when preferred
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { ChallengeListItem, WeightUnit } from '@nexera/types';
import { Text } from '../../src/components/Text';
import { ChallengeCard } from '../../src/components/challenges/ChallengeCard';
import { ChallengesScreenSkeleton } from '../../src/components/skeleton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { fetchChallenges, CHALLENGES_CACHE_KEY } from '../../src/lib/challengeService';
import { fetchFeedContext } from '../../src/lib/feedService';
import { splitByStatus } from '../../src/lib/challengeLogic';
import { cacheFirst, setCache, CacheTTL } from '../../src/lib/cacheManager';
import { getWeightUnit } from '../../src/lib/weightUnit';

type TabKey = 'active' | 'completed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export default function ChallengesScreen() {
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // memberId + gymId — resolved once on mount, stored via ref so callbacks don't need to re-run
  const gymIdRef = useRef<string | null>(null);
  const memberIdRef = useRef<string | null>(null);

  // Reduced-motion preference
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => undefined);
  }, []);

  // ─── Initial load ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setError(false);
    try {
      const [ctx, unit] = await Promise.all([fetchFeedContext(), getWeightUnit()]);
      setWeightUnit(unit);

      if (!ctx) {
        // No authenticated session — treat as empty / sign-in required
        setError(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      gymIdRef.current = ctx.gymId;
      memberIdRef.current = ctx.memberId;

      const data = await cacheFirst(
        CHALLENGES_CACHE_KEY(ctx.gymId) as any,
        () => fetchChallenges(ctx.gymId, ctx.memberId),
        CacheTTL.challengesList,
      );
      setChallenges(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Pull-to-refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    const gymId = gymIdRef.current;
    const memberId = memberIdRef.current;
    if (!gymId || !memberId) {
      setRefreshing(true);
      await load();
      return;
    }

    setRefreshing(true);
    try {
      const fresh = await fetchChallenges(gymId, memberId);
      await setCache(CHALLENGES_CACHE_KEY(gymId) as any, fresh);
      setChallenges(fresh);
      setError(false);
    } catch {
      // keep current list on transient refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // ─── Tab split ─────────────────────────────────────────────────────────────

  const { active: activeChallenges, completed: completedChallenges } = useMemo(
    () => splitByStatus(challenges),
    [challenges],
  );

  const visibleList = activeTab === 'active' ? activeChallenges : completedChallenges;

  // ─── Render helpers ────────────────────────────────────────────────────────

  const handleCardPress = useCallback((challengeId: string) => {
    router.push(`/challenges/${challengeId}` as any);
  }, []);

  const renderChallenge = useCallback(
    ({ item }: { item: ChallengeListItem }) => (
      <ChallengeCard
        challenge={item}
        weightUnit={weightUnit}
        onPress={() => handleCardPress(item.challenge_id)}
      />
    ),
    [weightUnit, handleCardPress],
  );

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Challenges</Text>
        </View>
        <ChallengesScreenSkeleton />
      </View>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error && challenges.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text variant="subheading">Couldn&apos;t load challenges</Text>
        <Text style={styles.errorSub}>Check your connection and try again.</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            load();
          }}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Empty state per tab ───────────────────────────────────────────────────

  const emptyContent =
    activeTab === 'active' ? (
      <View style={[styles.centered, styles.emptyWrap]}>
        <Text style={styles.emptyEmoji}>🏆</Text>
        <Text variant="subheading">No active challenges yet</Text>
        <Text style={styles.emptySub}>Check back soon — your gym will post one!</Text>
      </View>
    ) : (
      <View style={[styles.centered, styles.emptyWrap]}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text variant="subheading">No completed challenges yet</Text>
        <Text style={styles.emptySub}>Finished challenges will appear here.</Text>
      </View>
    );

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
      </View>

      {/* Active / Completed segmented toggle */}
      <View style={styles.toggleRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.toggleSegment, isActive && styles.toggleSegmentActive]}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {visibleList.length === 0 ? (
        emptyContent
      ) : (
        <FlatList
          data={visibleList}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.challenge_id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          // When reduced motion is on, skip staggered animations by bumping maxToRenderPerBatch
          maxToRenderPerBatch={reducedMotion ? 20 : 5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.h2Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    letterSpacing: -0.3,
  },

  // Active / Completed toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleSegment: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSegmentActive: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 9,
    margin: 1,
  },
  toggleText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  toggleTextActive: {
    color: colors.primary,
    fontFamily: typography.fontSemiBold,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 100,
    gap: spacing.sm,
  },

  // Error state
  errorIcon: {
    fontSize: 40,
  },
  errorSub: {
    fontSize: typography.smallSize,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  retryText: {
    fontSize: typography.bodySize,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontSize: typography.smallSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.smallSize * typography.smallLeading,
  },
});
