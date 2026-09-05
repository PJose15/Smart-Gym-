/**
 * Feed tab — mobile social feed (DOC_05, adapted to the real schema).
 *
 * Data flows directly through Supabase with RLS (no cookie session exists on
 * mobile, so the web-admin API routes are not callable here — see
 * src/lib/feedService.ts for the policy ground truth).
 *
 * State machine: LOADING → (EMPTY | ERROR | SUCCESS) with REFRESHING and
 * PAGINATING sub-states, per DOC_05 §4.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { FeedEventFull, ReactionType, WeightUnit } from '@nexera/types';
import { supabase } from '../../src/lib/supabase';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { FeedSkeleton } from '../../src/components/skeleton';
import { FeedEventCard } from '../../src/components/feed/FeedEventCard';
import { FeedFilterBar } from '../../src/components/feed/FeedFilterBar';
import { FeedEmptyState } from '../../src/components/feed/FeedEmptyState';
import { CommentsSheet } from '../../src/components/feed/CommentsSheet';
import {
  filterFeedEvents,
  mergeFeedEvents,
  toggleReactionInList,
  type FeedFilter,
} from '../../src/lib/feedLogic';
import {
  fetchEventsSince,
  fetchFeedContext,
  fetchFeedPage,
  fetchFollowingIds,
  followMember,
  persistReactionToggle,
  unfollowMember,
  type FeedContext,
} from '../../src/lib/feedService';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { clearUserScopedStorage } from '../../src/lib/signOutCleanup';
import { markFeedViewed } from '../../src/hooks/useUnreadFeedCount';

export default function FeedScreen() {
  const { eventId: deepLinkEventId } = useLocalSearchParams<{ eventId?: string }>();

  const [context, setContext] = useState<FeedContext | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [events, setEvents] = useState<FeedEventFull[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [commentsEventId, setCommentsEventId] = useState<string | null>(null);

  const listRef = useRef<FlatList<FeedEventFull>>(null);
  const eventsRef = useRef<FeedEventFull[]>([]);
  eventsRef.current = events;
  const scrolledToDeepLink = useRef(false);

  // Focus tracking for the realtime handler (ref so the subscription effect
  // doesn't tear down/resubscribe on every focus change).
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const missedWhileBlurredRef = useRef(false);
  const fetchFreshRef = useRef<(() => void) | null>(null);

  // ─── Initial load ─────────────────────────────────────

  const load = useCallback(async () => {
    setError(false);
    try {
      const [ctx, unit] = await Promise.all([fetchFeedContext(), getWeightUnit()]);
      setWeightUnit(unit);
      if (ctx === 'signed-out') {
        // Session expired or was revoked — re-auth instead of showing a
        // fake "check your connection" error. Clear user-scoped storage so
        // a different account signing in next doesn't inherit this user's
        // caches/queue.
        await clearUserScopedStorage().catch(() => {});
        await supabase.auth.signOut().catch(() => {});
        router.replace('/auth');
        return;
      }
      if (!ctx) {
        setError(true);
        return;
      }
      setContext(ctx);

      const [page, following] = await Promise.all([
        fetchFeedPage(ctx.gymId, ctx.memberId),
        fetchFollowingIds(ctx.memberId).catch(() => new Set<string>()),
      ]);
      setEvents(page.events);
      setNextCursor(page.nextCursor);
      setFollowingIds(following);
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

  // Refresh the weight unit when returning from Settings + clear tab badge.
  useFocusEffect(
    useCallback(() => {
      getWeightUnit().then(setWeightUnit);
      markFeedViewed();
      // Realtime inserts that arrived while this tab was blurred were NOT
      // fetched (battery) — catch up now.
      if (missedWhileBlurredRef.current) {
        missedWhileBlurredRef.current = false;
        fetchFreshRef.current?.();
      }
    }, []),
  );

  // ─── Pull-to-refresh / pagination ─────────────────────

  const handleRefresh = useCallback(async () => {
    if (!context) {
      setRefreshing(true);
      await load();
      return;
    }
    setRefreshing(true);
    try {
      const page = await fetchFeedPage(context.gymId, context.memberId);
      setEvents(page.events);
      setNextCursor(page.nextCursor);
      setError(false);
      markFeedViewed();
    } catch {
      // keep existing list on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [context, load]);

  const handleLoadMore = useCallback(async () => {
    if (!context || !nextCursor || loadingMore || refreshing) return;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage(context.gymId, context.memberId, nextCursor);
      setEvents((prev) => mergeFeedEvents(prev, page.events, 'append'));
      setNextCursor(page.nextCursor);
    } catch {
      // silent — user can scroll again to retry
    } finally {
      setLoadingMore(false);
    }
  }, [context, nextCursor, loadingMore, refreshing]);

  // ─── Realtime: prepend new gym events (DOC_05 §9) ─────

  useEffect(() => {
    if (!context) return;
    const { gymId, memberId } = context;
    let fetching = false;

    const fetchFresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const newest = eventsRef.current.find((e) => !e.is_pinned) ?? eventsRef.current[0];
        const since = newest?.created_at ?? new Date(0).toISOString();
        const fresh = await fetchEventsSince(gymId, memberId, since);
        if (fresh.length > 0) {
          setEvents((prev) => mergeFeedEvents(prev, fresh, 'prepend'));
        }
        // User is watching the feed — new events are "seen", keep badge dark.
        if (isFocusedRef.current) markFeedViewed();
      } catch {
        // transient realtime fetch failure — next insert retries
      } finally {
        fetching = false;
      }
    };
    fetchFreshRef.current = fetchFresh;

    const channel = supabase
      .channel(`feed:${gymId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gym_feed_events', filter: `gym_id=eq.${gymId}` },
        () => {
          // Don't refetch while backgrounded — flag it and catch up on refocus.
          if (!isFocusedRef.current) {
            missedWhileBlurredRef.current = true;
            return;
          }
          fetchFresh();
        },
      )
      .subscribe();

    return () => {
      fetchFreshRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [context]);

  // ─── Reactions (optimistic, toggle is its own inverse) ─

  const handleToggleReaction = useCallback(
    async (eventId: string, type: ReactionType) => {
      if (!context) return;
      const target = eventsRef.current.find((e) => e.id === eventId);
      if (!target) return;
      const wasActive = target.my_reactions.includes(type);

      setEvents((prev) => toggleReactionInList(prev, eventId, type));
      try {
        await persistReactionToggle(eventId, context.memberId, type, wasActive);
      } catch {
        // Roll back — applying the same toggle again restores the old state.
        setEvents((prev) => toggleReactionInList(prev, eventId, type));
      }
    },
    [context],
  );

  // ─── Follow / unfollow (optimistic with rollback) ─────

  const handleToggleFollow = useCallback(
    async (targetMemberId: string, isFollowing: boolean) => {
      if (!context) return;
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(targetMemberId);
        else next.add(targetMemberId);
        return next;
      });
      try {
        if (isFollowing) await unfollowMember(context.memberId, targetMemberId);
        else await followMember(context.memberId, targetMemberId);
      } catch {
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (isFollowing) next.add(targetMemberId);
          else next.delete(targetMemberId);
          return next;
        });
      }
    },
    [context],
  );

  // ─── Comments count sync from the sheet ───────────────

  const handleCommentCountChange = useCallback((eventId: string, delta: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, comment_count: Math.max(e.comment_count + delta, 0) }
          : e,
      ),
    );
  }, []);

  // ─── Filtering + deep link ────────────────────────────

  const filteredEvents = useMemo(
    () => filterFeedEvents(events, activeFilter),
    [events, activeFilter],
  );

  useEffect(() => {
    if (!deepLinkEventId || scrolledToDeepLink.current || filteredEvents.length === 0) return;
    const index = filteredEvents.findIndex((e) => e.id === deepLinkEventId);
    if (index === -1) return;
    scrolledToDeepLink.current = true;
    const timer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
      } catch {
        // out-of-range after filtering — ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [deepLinkEventId, filteredEvents]);

  // ─── Render ───────────────────────────────────────────

  const renderEvent = useCallback(
    ({ item }: { item: FeedEventFull }) => (
      <FeedEventCard
        event={item}
        currentMemberId={context?.memberId ?? ''}
        weightUnit={weightUnit}
        isFollowing={item.member_id != null && followingIds.has(item.member_id)}
        onToggleReaction={handleToggleReaction}
        onOpenComments={setCommentsEventId}
        onToggleFollow={handleToggleFollow}
      />
    ),
    [context?.memberId, weightUnit, followingIds, handleToggleReaction, handleToggleFollow],
  );

  const gymTitle = context?.gymName ? `${context.gymName} Feed` : 'Gym Feed';

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{gymTitle}</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <FeedSkeleton />
        </View>
      </View>
    );
  }

  if (error && events.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text variant="subheading">Couldn&apos;t load the feed</Text>
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {gymTitle}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/leaderboard')}
            accessibilityRole="button"
            accessibilityLabel="Open leaderboard"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.leaderboardButton}
          >
            <Ionicons name="podium-outline" size={20} color={colors.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/challenges')}
            accessibilityRole="button"
            accessibilityLabel="Open challenges"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.challengesButton}
          >
            <Ionicons name="trophy-outline" size={20} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      <FeedFilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {filteredEvents.length === 0 ? (
        <FeedEmptyState
          reason={activeFilter !== 'all' && events.length > 0 ? 'filter_empty' : 'new_member'}
          onClearFilter={() => setActiveFilter('all')}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScrollToIndexFailed={() => {
            // FlatList hasn't measured that far — fall back silently
          }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={styles.footerSpinner} />
            ) : null
          }
        />
      )}

      {commentsEventId && context && (
        <CommentsSheet
          eventId={commentsEventId}
          myMemberId={context.memberId}
          onClose={() => setCommentsEventId(null)}
          onCommentCountChange={handleCommentCountChange}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  challengesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaderboardButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.h2Size,
    fontFamily: typography.fontBold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  skeletonWrap: {
    paddingHorizontal: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  footerSpinner: {
    marginVertical: spacing.lg,
  },
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
});
