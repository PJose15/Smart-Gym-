'use client';

import { useEffect, useRef, useState } from 'react';
import { getPendingSets, markSynced, clearSyncedSets } from '@/lib/stores/offlineQueueStore';

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const syncPending = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const pending = await getPendingSets();
      setPendingCount(pending.length);

      for (const entry of pending) {
        try {
          const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gym_id: entry.gym_id,
              machine_id: entry.machine_id,
              member_id: entry.member_id,
              session_date: entry.session_date,
              workout_mode: entry.workout_mode,
              set: entry.set,
            }),
          });
          if (res.ok) {
            await markSynced(entry.id);
            setPendingCount((c) => Math.max(0, c - 1));
          }
        } catch {
          break; // Still offline
        }
      }

      await clearSyncedSets();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Sync on mount
    syncPending();

    // Sync on reconnect
    const handler = () => syncPending();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, []);

  return { pendingCount, syncing, syncPending };
}
