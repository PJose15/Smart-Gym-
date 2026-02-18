/**
 * Simple in-memory cache with TTL for AI assist data.
 * Runs client-side — entries expire after maxAge ms.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LocalCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultMaxAge = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, maxAge?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (maxAge ?? this.defaultMaxAge),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Build cache key for next-set suggestions */
  static suggestionKey(workoutExerciseId: string): string {
    return `suggestion:${workoutExerciseId}`;
  }

  /** Build cache key for feature flags */
  static featureFlagKey(gymId: string | null, profileId: string | null): string {
    return `flags:${gymId ?? 'global'}:${profileId ?? 'all'}`;
  }

  /** Build cache key for machine cues */
  static machineCueKey(machineId: string): string {
    return `cues:${machineId}`;
  }
}

export const localCache = new LocalCache();
