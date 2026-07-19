export interface OnboardingStatusResponse {
  checklist: {
    has_machine: boolean;
    has_members: boolean;
    has_shared_qr: boolean;
  };
  trial: {
    is_trialing: boolean;
    trial_ends_at: string | null;
    days_remaining: number | null;
  };
}

/**
 * Pure helper: compute days remaining in a trial, clamped to 0 (never negative).
 * Uses Math.ceil so 10.5 days → 11.
 *
 * @param trialEndsAt - ISO date string or null
 * @param now         - epoch ms (injectable for testing; defaults to Date.now())
 */
export function computeDaysRemaining(
  trialEndsAt: string | null,
  now: number = Date.now()
): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now) / 86_400_000));
}
