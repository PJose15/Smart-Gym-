/**
 * Feature flag system — fetches flags from Supabase,
 * caches locally, and provides a simple isEnabled check.
 */
import { supabase } from './supabase';
import type { FeatureFlag } from '@nexera/types';

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
      .select('*')
      .or(`profile_id.eq.${user.id},profile_id.is.null`);

    if (error || !data) return;

    const flags = data as FeatureFlag[];
    const resolved = new Map<string, boolean>();

    // First pass: gym-level flags (lower priority)
    for (const flag of flags) {
      if (flag.profile_id === null) {
        resolved.set(flag.key, flag.enabled);
      }
    }

    // Second pass: user-specific overrides (higher priority)
    for (const flag of flags) {
      if (flag.profile_id === user.id) {
        resolved.set(flag.key, flag.enabled);
      }
    }

    flagCache = resolved;
    lastFetch = Date.now();
  } catch (err) {
    console.warn('[flags] refresh failed:', err);
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
