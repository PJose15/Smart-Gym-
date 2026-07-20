import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of a caller-provided key against an expected
 * secret. Returns false when either side is missing/empty. Length mismatch
 * returns false without leaking timing beyond the length itself (inherent
 * to any comparison).
 *
 * Used by /api/agents/trigger and the cron routes for
 * x-smartgym-internal-key / service-role bearer checks.
 */
export function safeKeyEquals(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
