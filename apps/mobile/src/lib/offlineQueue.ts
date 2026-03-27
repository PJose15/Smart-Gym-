/**
 * Offline queue backed by AsyncStorage.
 * Queues failed event/feedback inserts for later replay when online.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@nexera/offline_queue';

export interface QueuedItem {
  table: string;
  payload: Record<string, unknown>;
  queuedAt: string;
}

async function readQueue(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** Add a failed insert to the offline queue. */
export async function enqueueEvent(
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const queue = await readQueue();
  queue.push({ table, payload, queuedAt: new Date().toISOString() });
  await writeQueue(queue);
}

/**
 * Flush the offline queue by replaying inserts.
 * Requires a function that performs the actual Supabase insert.
 * Successfully replayed items are removed; failures stay queued.
 */
export async function flushQueue(
  insertFn: (table: string, payload: Record<string, unknown>) => Promise<boolean>,
): Promise<{ flushed: number; remaining: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const failed: QueuedItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const ok = await insertFn(item.table, item.payload);
      if (ok) {
        flushed++;
      } else {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  await writeQueue(failed);
  return { flushed, remaining: failed.length };
}

/** Get the number of queued items. */
export async function getQueueSize(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/** Clear the entire queue. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
