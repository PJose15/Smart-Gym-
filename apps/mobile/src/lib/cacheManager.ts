/**
 * AsyncStorage-backed cache with TTL and versioning.
 * Provides cache-first reads with background refresh support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@smartgym/cache/';
const CACHE_VERSION = 1;

interface CacheEntry<T> {
  data: T;
  version: number;
  cachedAt: number; // epoch ms
}

/** TTL configurations in milliseconds. */
export const CacheTTL = {
  machinesList: 10 * 60 * 1000,       // 10 minutes
  machineDetail: 30 * 60 * 1000,      // 30 minutes
  trainingProfile: 15 * 60 * 1000,    // 15 minutes
  featureFlags: 5 * 60 * 1000,        // 5 minutes
  guardrailInsights: 5 * 60 * 1000,   // 5 minutes
  todayExplanation: 30 * 60 * 1000,   // 30 minutes
} as const;

export type CacheKey = keyof typeof CacheTTL | (string & {});

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/** Read a cached value. Returns null if missing, expired, or wrong version. */
export async function getCached<T>(key: CacheKey, ttlMs?: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;

    const ttl = ttlMs ?? CacheTTL[key as keyof typeof CacheTTL];
    if (ttl && Date.now() - entry.cachedAt > ttl) return null;

    return entry.data;
  } catch {
    return null;
  }
}

/** Write a value to cache. */
export async function setCache<T>(key: CacheKey, data: T): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    version: CACHE_VERSION,
    cachedAt: Date.now(),
  };
  await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
}

/** Remove a specific cache entry. */
export async function clearCache(key: CacheKey): Promise<void> {
  await AsyncStorage.removeItem(storageKey(key));
}

/** Remove all SmartGym cache entries. */
export async function clearAllCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

/**
 * Cache-first fetch pattern.
 * Returns cached data immediately if available, then refreshes in the background.
 * @returns The cached or fresh data.
 */
export async function cacheFirst<T>(
  key: CacheKey,
  fetchFn: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const cached = await getCached<T>(key, ttlMs);
  if (cached !== null) {
    // Background refresh (fire-and-forget)
    fetchFn()
      .then((fresh) => setCache(key, fresh))
      .catch(() => {});
    return cached;
  }

  const fresh = await fetchFn();
  await setCache(key, fresh);
  return fresh;
}
