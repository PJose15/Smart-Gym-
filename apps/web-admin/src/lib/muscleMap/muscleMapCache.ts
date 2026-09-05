import type { SupabaseClient } from '@supabase/supabase-js';
import type { MuscleMapResult } from '@nexera/types';
import { buildMemberMuscleMap } from './buildMemberMuscleMap';

/**
 * Max cache age. Recovery states advance hour-by-hour, so a map computed at
 * 00:05 UTC must not be served all day just because the date key matches.
 */
const MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000;

/** True when the cached row is younger than MAX_CACHE_AGE_MS. */
function isCacheFresh(computedAt: string | null | undefined): boolean {
  if (!computedAt) return false;
  const ts = new Date(computedAt).getTime();
  return !isNaN(ts) && Date.now() - ts < MAX_CACHE_AGE_MS;
}

/**
 * Get muscle map, using cache when valid.
 * Computes fresh if cache is stale (missing, or older than 6h).
 */
export async function getMuscleMap(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<MuscleMapResult> {
  const today = new Date().toISOString().split('T')[0];

  // Check cache first
  const { data: cached } = await admin
    .from('member_muscle_cache')
    .select('*')
    .eq('member_id', memberId)
    .eq('cache_date', today)
    .single();

  if (cached && isCacheFresh(cached.computed_at)) {
    // Reconstruct MuscleMapResult from cached JSON
    const { _balanceScore, ...cleanStates } = cached.muscle_states ?? {};
    return {
      memberId,
      computedAt: cached.computed_at,
      states: cleanStates,
      recommendations: cached.recommendations,
      balanceScore: typeof _balanceScore === 'number' ? _balanceScore : 50,
    } as MuscleMapResult;
  }

  // Compute fresh
  const result = await buildMemberMuscleMap(memberId, gymId, admin);

  // Save to cache (upsert on unique member_id + cache_date)
  // Store balance score separately under _balanceScore key
  const { error: upsertError } = await admin
    .from('member_muscle_cache')
    .upsert(
      {
        member_id: memberId,
        gym_id: gymId,
        cache_date: today,
        muscle_states: { ...result.states, _balanceScore: result.balanceScore },
        recommendations: result.recommendations,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,cache_date' }
    );

  if (upsertError) {
    console.error('[muscleMapCache] Upsert error:', upsertError.message);
  }

  return result;
}

/**
 * Invalidate today's muscle map cache and recompute immediately.
 * Called fire-and-forget after session completion.
 */
export async function invalidateAndRefreshMuscleMap(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Delete today's cache entry
  const { error: deleteError } = await admin
    .from('member_muscle_cache')
    .delete()
    .eq('member_id', memberId)
    .eq('cache_date', today);

  if (deleteError) {
    console.error('[muscleMapCache] Delete error:', deleteError.message);
  }

  // Recompute and cache immediately
  await getMuscleMap(memberId, gymId, admin);
}
