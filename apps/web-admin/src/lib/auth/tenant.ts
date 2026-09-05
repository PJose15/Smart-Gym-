import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tenant-binding helpers (Stage 5).
 * Routes must derive gym_id from the verified member row — never trust a
 * caller-supplied gym_id — and must verify that any referenced row
 * (event, session, challenge, machine, program) belongs to that gym.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, 'public', any>;

/**
 * Resolve the gym a member belongs to. Returns null when the member row
 * doesn't exist (treat as 403/404 — never fall back to a body gym_id).
 */
export async function resolveMemberGym(
  admin: Admin,
  memberId: string
): Promise<string | null> {
  const { data } = await admin
    .from('members')
    .select('gym_id')
    .eq('id', memberId)
    .maybeSingle();
  return data?.gym_id ?? null;
}

/**
 * Verify that `id` in `table` belongs to `gymId` (via the table's gym_id
 * column). Returns false for missing rows or cross-tenant rows alike, so
 * callers can respond 404 without leaking existence.
 */
export async function assertInGym(
  admin: Admin,
  table: string,
  id: string,
  gymId: string
): Promise<boolean> {
  const { data } = await admin
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('gym_id', gymId)
    .maybeSingle();
  return !!data;
}
