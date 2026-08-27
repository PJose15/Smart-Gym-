import type { SupabaseClient } from '@supabase/supabase-js';
import type { DNAResult } from '@nexera/types';
import { computeMemberDNA } from './computeDNA';
import { ARCHETYPE_PRESTIGE } from '@nexera/ai-assist';

/** In-flight deduplication: prevents concurrent computations for the same member */
const inFlight = new Map<string, Promise<DNAResult>>();

/**
 * Get DNA result, using cache when valid.
 * Computes fresh if cache is missing or stale (> 1 day).
 */
export async function getDNAResult(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<DNAResult> {
  // Check cache
  const { data: cached } = await admin
    .from('member_dna_cache')
    .select('*')
    .eq('member_id', memberId)
    .single();

  if (cached && isCacheValid(cached.computed_at)) {
    return JSON.parse(cached.result_json) as DNAResult;
  }

  // Deduplicate concurrent requests for the same member
  const existing = inFlight.get(memberId);
  if (existing) {
    return existing;
  }

  const computation = computeMemberDNA(memberId, gymId, admin);
  inFlight.set(memberId, computation);

  // Compute fresh
  let result: DNAResult;
  try {
    result = await computation;
  } finally {
    inFlight.delete(memberId);
  }

  // Upsert cache
  await admin.from('member_dna_cache').upsert(
    {
      member_id: memberId,
      gym_id: gymId,
      power_score: result.scores.power,
      consistency_score: result.scores.consistency,
      progression_score: result.scores.progression,
      balance_score: result.scores.balance,
      mindset_score: result.scores.mindset,
      archetype_id: result.archetype.id,
      archetype_changed: result.archetype_changed,
      previous_archetype_id: result.previous_archetype?.id ?? null,
      is_building: result.is_building,
      sessions_logged: result.sessions_logged,
      distinct_machines: result.distinct_machines,
      result_json: JSON.stringify(result),
      signals_json: JSON.stringify(result.signals),
      computed_at: new Date().toISOString(),
      last_full_compute: new Date().toISOString(),
    },
    { onConflict: 'member_id' }
  );

  // Create feed event if archetype changed and prestige increased
  if (result.archetype_changed && result.previous_archetype) {
    const newPrestige = ARCHETYPE_PRESTIGE[result.archetype.id] ?? 0;
    const oldPrestige = ARCHETYPE_PRESTIGE[result.previous_archetype.id] ?? 0;
    if (newPrestige > oldPrestige) {
      await admin.from('gym_feed_events').insert({
        gym_id: gymId,
        member_id: memberId,
        event_type: 'archetype_change',
        // display_text is rendered after a bold member-name span by the UI,
        // so producers must NOT prefix the member name here.
        display_text: `became ${result.archetype.name}`,
        context_data: {
          archetype_id: result.archetype.id,
          archetype_name: result.archetype.name,
          archetype_icon: result.archetype.icon,
          previous_archetype_id: result.previous_archetype.id,
        },
        priority: 'medium',
      });
    }
  }

  return result;
}

/**
 * Invalidate cache and recompute immediately.
 * Also creates a weekly snapshot.
 * Waits for any in-flight computation to complete before invalidating
 * to prevent race conditions.
 */
export async function invalidateAndRefreshDNA(
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  // Wait for any in-flight computation to finish before invalidating
  const existing = inFlight.get(memberId);
  if (existing) {
    try { await existing; } catch { /* ignore — we're recomputing anyway */ }
  }

  // Delete existing cache
  await admin.from('member_dna_cache').delete().eq('member_id', memberId);

  // Recompute (getDNAResult will compute fresh since cache was just deleted)
  const result = await getDNAResult(memberId, gymId, admin);

  // Create weekly snapshot
  if (!result.is_building) {
    const today = new Date().toISOString().split('T')[0];
    await admin.from('member_dna_snapshots').upsert(
      {
        member_id: memberId,
        gym_id: gymId,
        snapshot_date: today,
        power_score: result.scores.power,
        consistency_score: result.scores.consistency,
        progression_score: result.scores.progression,
        balance_score: result.scores.balance,
        mindset_score: result.scores.mindset,
        archetype_id: result.archetype.id,
      },
      { onConflict: 'member_id,snapshot_date' }
    );
  }
}

/** Cache is valid if computed within the last 24 hours */
function isCacheValid(computedAt: string): boolean {
  const computedTime = new Date(computedAt).getTime();
  const oneDayAgo = Date.now() - 24 * 3600000;
  return computedTime > oneDayAgo;
}
