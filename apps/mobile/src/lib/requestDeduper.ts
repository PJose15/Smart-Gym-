/**
 * Request deduplication utility.
 * Ensures only one in-flight request per key at a time.
 * Subsequent callers with the same key receive the same promise.
 */

const inflight = new Map<string, Promise<unknown>>();

export const deduper = {
  /**
   * Deduplicates in-flight requests by key.
   * If a request with the same key is already in progress, returns the existing promise.
   * Otherwise, starts the request and shares the promise until it resolves/rejects.
   */
  dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => {
      inflight.delete(key);
    });

    inflight.set(key, promise);
    return promise;
  },

  /** Clear a specific key (useful for forced refresh). */
  clear(key: string): void {
    inflight.delete(key);
  },

  /** Clear all tracked requests. */
  clearAll(): void {
    inflight.clear();
  },
};
