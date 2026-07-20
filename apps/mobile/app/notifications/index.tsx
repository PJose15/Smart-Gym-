/**
 * Notification inbox screen (NOTIF-05 — Phase 6 Plan 09).
 *
 * Stack route (not a tab). Shows newest-first list of member notifications.
 * Unread rows are visually distinct (accent left-border + brighter title).
 * Tap marks read optimistically and deep-links via resolveNotificationRoute.
 * Supports cursor-based pagination (onEndReached) and pull-to-refresh.
 * Shows skeleton on first load and an empty state when inbox is clear.
 *
 * Design: DOC_18 dark tokens from src/theme/colors.ts only — no hardcoded hex.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Text } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  fetchInbox,
  markRead,
  type InboxNotification,
} from '../../src/lib/notificationInboxService';
import { markInboxViewed } from '../../src/hooks/useUnreadNotifications';
import { resolveNotificationRoute } from '../../src/lib/notificationService';
import type { NotificationType } from '@nexera/types';

// ─── Relative timestamp ───────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <View style={styles.skeletonContainer} accessibilityElementsHidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonBody} />
          <View style={styles.skeletonMeta} />
        </View>
      ))}
    </View>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

interface NotifRowProps {
  item: InboxNotification;
  onPress: (item: InboxNotification) => void;
}

function NotifRow({ item, onPress }: NotifRowProps) {
  const isUnread = item.read_at === null;
  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? 'Unread notification: ' : ''}${item.title}. ${item.body}. ${relativeTime(item.created_at)}`}
    >
      {isUnread && <View style={styles.unreadAccent} />}
      <View style={styles.rowContent}>
        <Text
          variant="body"
          style={[styles.rowTitle, isUnread && styles.rowTitleUnread]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          variant="caption"
          color="textSecondary"
          style={styles.rowBody}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text variant="caption" style={[styles.rowTime, { color: colors.textMuted }]}>
          {relativeTime(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const load = useCallback(async (reset = false) => {
    const cursor = reset ? undefined : (nextCursorRef.current ?? undefined);
    if (!reset && !hasMoreRef.current) return;

    const result = await fetchInbox(cursor);
    if (!result) {
      setError('Could not load notifications. Pull down to retry.');
      return;
    }

    setError(null);
    nextCursorRef.current = result.next_cursor;
    hasMoreRef.current = result.next_cursor !== null;

    setNotifications((prev) =>
      reset ? result.notifications : [...prev, ...result.notifications],
    );
  }, []);

  useEffect(() => {
    load(true).finally(() => setLoading(false));
    // Notify hook instances to zero the badge immediately
    markInboxViewed();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    hasMoreRef.current = true;
    await load(true);
    setRefreshing(false);
  }, [load]);

  const handleEndReached = useCallback(async () => {
    if (!hasMoreRef.current || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [load, loadingMore]);

  const handlePress = useCallback(async (item: InboxNotification) => {
    // Optimistic: flip read_at in local state immediately
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );

    // Server mark-read (best-effort; failures don't revert — next refresh resyncs)
    await markRead(item.id);

    // Refresh badge on all mounted hook instances
    markInboxViewed();

    // Deep-link navigation
    const path = resolveNotificationRoute(
      item.notification_type as NotificationType,
      item.data as Record<string, string>,
    );
    if (path) {
      router.push(path as Href);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.screen}>
        <NotificationSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {error && !refreshing && (
        <View style={styles.errorBanner}>
          <Text variant="caption" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifRow item={item} onPress={handlePress} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContent : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View accessibilityElementsHidden>
              <Text variant="heading" style={styles.emptyIcon}>{'🔔'}</Text>
            </View>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              No notifications yet — go crush a workout!
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMore}>
              <Text variant="caption" style={{ color: colors.textMuted }}>
                Loading more...
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  emptyContent: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowUnread: {
    backgroundColor: colors.surfaceElevated,
  },
  unreadAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
    alignSelf: 'stretch',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: typography.fontSemiBold,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rowTitleUnread: {
    color: colors.text,
  },
  rowBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  rowTime: {
    fontSize: 11,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.errorSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  // Skeleton styles (DOC_18 bgSkeleton tokens)
  skeletonContainer: {
    paddingTop: spacing.sm,
  },
  skeletonRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  skeletonTitle: {
    height: 14,
    width: '70%',
    borderRadius: 4,
    backgroundColor: colors.bgSkeleton,
    marginBottom: spacing.xs,
  },
  skeletonBody: {
    height: 12,
    width: '90%',
    borderRadius: 4,
    backgroundColor: colors.bgSkeleton,
    marginBottom: spacing.xs,
  },
  skeletonMeta: {
    height: 10,
    width: '25%',
    borderRadius: 4,
    backgroundColor: colors.bgSkeleton,
  },
});
