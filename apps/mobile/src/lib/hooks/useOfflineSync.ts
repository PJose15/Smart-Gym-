/**
 * Flushes the offline queue when connectivity is restored.
 * Mount once (e.g. in root layout) — it subscribes to NetInfo
 * and replays queued inserts via Supabase on reconnect.
 */
import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushQueue, getQueueSize, type ReplayResult } from '../offlineQueue';
import { OFFLINE_SET_QUEUE_TABLE, replayQueuedSet } from '../sessionApi';
import { supabase } from '../supabase';

export function useOfflineSync(): { isSyncing: boolean } {
  const wasOffline = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected && state.isInternetReachable !== false;

      if (!online) {
        wasOffline.current = true;
        return;
      }

      // Only flush when transitioning from offline → online
      if (!wasOffline.current) return;
      wasOffline.current = false;

      try {
        const size = await getQueueSize();
        if (size === 0) return;

        setIsSyncing(true);
        const { flushed, remaining, dropped } = await flushQueue(
          async (table, payload): Promise<ReplayResult> => {
            // Queued set logs are NOT direct table inserts — they replay
            // through the sessions API (the queue "table" is a pseudo-name).
            if (table === OFFLINE_SET_QUEUE_TABLE) {
              return replayQueuedSet(table, payload);
            }
            const { error } = await supabase.from(table).insert(payload);
            if (!error) return true;
            // Postgres errors (constraint/RLS/schema — have a PG code) will
            // never succeed on retry; network-level failures have no code.
            return error.code ? 'drop' : false;
          },
        );

        if ((flushed > 0 || dropped > 0) && __DEV__) {
          console.log(
            `[offlineSync] Flushed ${flushed} items, dropped ${dropped}, ${remaining} remaining`,
          );
        }
      } catch (err) {
        if (__DEV__) console.warn('[offlineSync] Flush failed:', err instanceof Error ? err.message : err);
      } finally {
        setIsSyncing(false);
      }
    });

    return unsubscribe;
  }, []);

  return { isSyncing };
}
