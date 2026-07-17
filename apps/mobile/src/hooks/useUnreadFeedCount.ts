/**
 * useUnreadFeedCount — feed tab badge (DOC_05 §14).
 *
 * Tracks how many gym feed events arrived since the member last viewed the
 * feed. Last-viewed timestamp persists in AsyncStorage; new events bump the
 * count via a Supabase Realtime subscription (publication on
 * gym_feed_events, migration 003). `markFeedViewed()` resets the badge and
 * notifies every mounted hook instance through a module-level listener set
 * (the tab layout and the feed screen are separate component trees).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const LAST_VIEWED_KEY = 'nexera_feed_last_viewed_at';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Persist "feed viewed now" and zero every active badge. */
export async function markFeedViewed(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_VIEWED_KEY, new Date().toISOString());
  } catch {
    // non-fatal — badge just stays until next successful write
  }
  listeners.forEach((fn) => fn());
}

export function useUnreadFeedCount(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);
  const gymIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCount(0);
        return;
      }

      if (!gymIdRef.current) {
        const { data: member } = await supabase
          .from('members')
          .select('gym_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        gymIdRef.current = member?.gym_id ?? null;
      }
      const gymId = gymIdRef.current;
      if (!gymId) {
        setCount(0);
        return;
      }

      const lastViewed = await AsyncStorage.getItem(LAST_VIEWED_KEY);
      let query = supabase
        .from('gym_feed_events')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .neq('priority', 'hidden');
      if (lastViewed) query = query.gt('created_at', lastViewed);

      const { count: unread } = await query;
      setCount(Math.max(unread ?? 0, 0));
    } catch {
      // leave current badge value on transient errors
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const listener: Listener = () => {
      if (!cancelled) setCount(0);
    };
    listeners.add(listener);

    refresh();

    // Realtime: bump the badge when new events land for this gym.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // Wait for gym resolution from the initial refresh
      if (!gymIdRef.current) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: member } = await supabase
          .from('members')
          .select('gym_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        gymIdRef.current = member?.gym_id ?? null;
      }
      const gymId = gymIdRef.current;
      if (!gymId || cancelled) return;

      channel = supabase
        .channel(`feed-badge:${gymId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'gym_feed_events', filter: `gym_id=eq.${gymId}` },
          () => {
            if (!cancelled) setCount((c) => c + 1);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      listeners.delete(listener);
      channel?.unsubscribe();
    };
  }, [refresh]);

  return { count, refresh };
}
