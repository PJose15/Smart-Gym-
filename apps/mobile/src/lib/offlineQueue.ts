/**
 * Offline queue backed by AsyncStorage.
 * Queues failed event/feedback inserts for later replay when online.
 *
 * Poison-pill protection:
 * - Items older than QUEUE_TTL_MS (48h) are dropped before replay.
 * - Replay handlers may return 'drop' (permanent failure, e.g. HTTP 4xx /
 *   Postgres constraint errors) to discard an item instead of retrying it
 *   forever. `false` means "transient failure — keep queued".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@nexera/offline_queue';

/** Drop queued items older than this (48 hours). */
export const QUEUE_TTL_MS = 48 * 60 * 60 * 1000;

export interface QueuedItem {
  table: string;
  payload: Record<string, unknown>;
  queuedAt: string;
}

/**
 * Replay handler result:
 * - `true`   — replayed successfully, remove from queue
 * - `false`  — transient failure (network/5xx), keep queued
 * - `'drop'` — permanent failure (4xx/constraint), remove without replaying
 */
export type ReplayResult = boolean | 'drop';

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

/** True when the item is past its replay TTL. */
function isExpired(item: QueuedItem, now: number): boolean {
  const queuedAt = new Date(item.queuedAt).getTime();
  if (Number.isNaN(queuedAt)) return true; // corrupt timestamp — drop
  return now - queuedAt > QUEUE_TTL_MS;
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
 * Requires a function that performs the actual replay (see ReplayResult).
 * Successfully replayed and permanently-failed items are removed; transient
 * failures stay queued. Items older than QUEUE_TTL_MS are dropped unreplayed.
 */
export async function flushQueue(
  insertFn: (table: string, payload: Record<string, unknown>) => Promise<ReplayResult>,
): Promise<{ flushed: number; remaining: number; dropped: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0, dropped: 0 };

  const now = Date.now();
  const failed: QueuedItem[] = [];
  let flushed = 0;
  let dropped = 0;

  for (const item of queue) {
    if (isExpired(item, now)) {
      dropped++;
      continue;
    }
    try {
      const result = await insertFn(item.table, item.payload);
      if (result === true) {
        flushed++;
      } else if (result === 'drop') {
        dropped++;
      } else {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  await writeQueue(failed);
  return { flushed, remaining: failed.length, dropped };
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
