/**
 * Feature flag system — fetches flags from Supabase,
 * caches locally, and provides a simple isEnabled check.
 */
import { supabase } from './supabase';

/** Row shape of the deployed feature_flags table (global flags, no per-user overrides). */
interface FeatureFlagRow {
  flag_key: string;
  is_enabled: boolean;
}

// Local in-memory cache
let flagCache: Map<string, boolean> = new Map();
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch feature flags for the current user and their gyms.
 * Caches results in memory for CACHE_TTL.
 */
export async function refreshFeatureFlags(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_key, is_enabled');

    if (error || !data) return;

    const flags = data as FeatureFlagRow[];
    const resolved = new Map<string, boolean>();
    for (const flag of flags) {
      resolved.set(flag.flag_key, flag.is_enabled);
    }

    flagCache = resolved;
    lastFetch = Date.now();
  } catch (err) {
    if (__DEV__) console.warn('[flags] refresh failed:', err);
  }
}

/**
 * Check if a feature is enabled.
 * Defaults to false if flag not found (AI Assist off by default).
 */
export function isFeatureEnabled(key: string): boolean {
  return flagCache.get(key) ?? false;
}

/**
 * Check if cache is stale and needs refresh.
 */
export function needsRefresh(): boolean {
  return Date.now() - lastFetch > CACHE_TTL;
}

/**
 * Clear the local flag cache.
 */
export function clearFlagCache(): void {
  flagCache = new Map();
  lastFetch = 0;
}
