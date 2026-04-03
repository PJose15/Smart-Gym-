/**
 * Flushes the offline queue when connectivity is restored.
 * Mount once (e.g. in root layout) — it subscribes to NetInfo
 * and replays queued inserts via Supabase on reconnect.
 */
import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushQueue, getQueueSize } from '../offlineQueue';
import { supabase } from '../supabase';

export function useOfflineSync() {
  const wasOffline = useRef(false);

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

        const { flushed, remaining } = await flushQueue(async (table, payload) => {
          const { error } = await supabase.from(table).insert(payload);
          return !error;
        });

        if (flushed > 0) {
          console.log(`[offlineSync] Flushed ${flushed} items, ${remaining} remaining`);
        }
      } catch (err) {
        console.warn('[offlineSync] Flush failed:', err instanceof Error ? err.message : err);
      }
    });

    return unsubscribe;
  }, []);
}
