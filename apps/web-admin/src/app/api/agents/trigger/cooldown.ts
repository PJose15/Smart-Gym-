/**
 * Cooldown module for /api/agents/trigger
 *
 * Pure functions for cooldown window calculation and platform event classification.
 * Extracted from route.ts to follow the repo convention: route files export only HTTP handlers.
 *
 * PLATFORM_EVENTS design rationale (planner-resolved):
 *
 *   `upgrade-opportunity` (revenue-agent, Pro-only) fires precisely BECAUSE a gym lacks
 *   a tier — it exists to surface upgrade intent when access is denied. Under strict tier
 *   gating it would be permanently dead code.
 *
 *   `new-gym-onboarded` (growth-agent, Pro-only) fires for brand-new gyms at registration.
 *   New gyms are always 'starter' at signup, so strict tier gating would suppress every
 *   new-gym automation.
 *
 *   Resolution: PLATFORM_EVENTS bypass checkAgentAccess because they are platform-growth
 *   events ABOUT the gym (revenue, onboarding funnel) — not agent services delivered TO
 *   the gym's members. All other events remain strictly tier-gated (Starter = 0 fires).
 */

/** Fallback cooldown when the event is not in COOLDOWN_MINUTES (60 minutes). */
export const DEFAULT_COOLDOWN_MINUTES = 60;

/**
 * Per-event cooldown in minutes.
 * Keyed by trigger_event value (must match the exact strings used at all call sites).
 */
export const COOLDOWN_MINUTES: Record<string, number> = {
  // Billing events (already wired via Stripe webhook)
  'subscription-cancelled': 60 * 24,
  'payment-failed': 60 * 24,
  'trial-ending-soon': 60 * 24,

  // Engagement agent
  'level-up': 60 * 24,
  'streak-broken': 60 * 24,
  'leaderboard-updated': 60 * 24,

  // Retention agent
  'member-at-risk': 60 * 24 * 7,
  'member-inactive-14d': 60 * 24 * 7,

  // Revenue agent
  'upgrade-opportunity': 60 * 24 * 7,

  // Operations agent
  // 6d, not 7d: weekly cron drift must never block next week's run
  'weekly-summary': 60 * 24 * 6,
  'machine-underutilized': 60 * 24 * 7,
  'checkin-sla-overdue': 60 * 24 * 7,

  // Growth agent
  // Deduplicates owner-complete + cron auto-expiry double path
  'challenge-ended': 60 * 24,
  'new-gym-onboarded': 60 * 24 * 30,
};

/**
 * Platform events bypass tier gating (see module-level comment for rationale).
 * These are events ABOUT the gym's growth/onboarding funnel, not services TO members.
 */
export const PLATFORM_EVENTS: readonly string[] = [
  'new-gym-onboarded',
  'upgrade-opportunity',
];

/**
 * Returns true when the trigger event is a platform-growth event that should bypass
 * the normal checkAgentAccess tier gate.
 */
export function isPlatformEvent(triggerEvent: string): boolean {
  return PLATFORM_EVENTS.includes(triggerEvent);
}

/**
 * Returns the ISO timestamp marking the start of the cooldown window for a given event.
 * Pass `now` for deterministic unit tests; defaults to current time.
 *
 * @param triggerEvent  The trigger_event value (e.g. 'level-up', 'member-at-risk')
 * @param now           Reference time (defaults to new Date())
 * @returns             ISO string for the window start (now - cooldownMinutes)
 */
export function getCooldownWindowStart(triggerEvent: string, now: Date = new Date()): string {
  const minutes = COOLDOWN_MINUTES[triggerEvent] ?? DEFAULT_COOLDOWN_MINUTES;
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}
