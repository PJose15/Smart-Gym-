import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReadinessResult } from '@nexera/types';
import { calculateReadinessScore } from '@nexera/ai-assist';
import { gatherReadinessInputs } from './gatherReadinessInputs';

/**
 * Get readiness score, using cache when valid.
 * Computes fresh if cache is stale or missing.
 */
export async function getReadinessScore(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<ReadinessResult> {
  const today = new Date().toISOString().split('T')[0];

  // Check cache first
  const { data: cached } = await admin
    .from('member_readiness_cache')
    .select('*')
    .eq('member_id', memberId)
    .eq('cache_date', today)
    .single();

  // Use cache if it exists AND was computed after the last session
  if (cached && isCacheValid(cached)) {
    return JSON.parse(cached.result_json) as ReadinessResult;
  }

  // Compute fresh
  const inputs = await gatherReadinessInputs(memberId, gymId, admin);
  const result = calculateReadinessScore(inputs);

  // Save to cache (upsert on unique member_id + cache_date)
  await admin
    .from('member_readiness_cache')
    .upsert(
      {
        member_id: memberId,
        gym_id: gymId,
        cache_date: today,
        score: result.score,
        zone: result.zone,
        result_json: JSON.stringify(result),
        inputs_json: JSON.stringify(inputs),
        dominant_signal: result.dominant_signal,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,cache_date' }
    );

  return result;
}

/**
 * Invalidate today's cache and recompute immediately.
 * Called fire-and-forget after session completion.
 */
export async function invalidateAndRefreshReadiness(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Delete today's cache entry
  await admin
    .from('member_readiness_cache')
    .delete()
    .eq('member_id', memberId)
    .eq('cache_date', today);

  // Recompute and cache immediately
  await getReadinessScore(memberId, gymId, admin);
}

function isCacheValid(cached: { computed_at: string }): boolean {
  // Date-based validity only — explicit invalidation via
  // invalidateAndRefreshReadiness handles session completions.
  const computedAt = new Date(cached.computed_at).getTime();
  return !isNaN(computedAt) && computedAt > 0;
}
