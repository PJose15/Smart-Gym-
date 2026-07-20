/**
 * useUnreadNotifications — notification bell badge (NOTIF-05).
 *
 * Tracks how many unread notifications the member has. Unread count is
 * sourced from fetchInbox().unread_count on mount and on focus-refresh.
 *
 * `markInboxViewed()` zeroes every mounted badge instance immediately
 * (module-listener pattern, same as useUnreadFeedCount) so the bell resets
 * as soon as the inbox screen opens — the server is the truth for persistence;
 * the in-memory listener handles the instant visual reset.
 *
 * No Realtime subscription: the notifications table is NOT in the realtime
 * publication. Poll-on-focus is sufficient for v1; add Realtime when the
 * publication is extended post-launch.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchInbox } from '../lib/notificationInboxService';

// ─── Module-level listener set (mirrors useUnreadFeedCount) ──────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Notify every mounted badge instance to zero its count immediately.
 * Call when the member opens the inbox screen.
 */
export function markInboxViewed(): void {
  listeners.forEach((fn) => fn());
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUnreadNotifications(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await fetchInbox();
    if (result !== null) {
      setCount(Math.max(result.unread_count, 0));
    }
    // On error, leave existing count unchanged (transient network issue)
  }, []);

  useEffect(() => {
    let cancelled = false;

    const listener: Listener = () => {
      if (!cancelled) setCount(0);
    };
    listeners.add(listener);

    // Initial fetch
    refresh();

    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [refresh]);

  // Refetch server truth whenever the host route regains focus (e.g. returning
  // from the inbox screen) — poll-on-focus is the v1 realtime substitute.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { count, refresh };
}
