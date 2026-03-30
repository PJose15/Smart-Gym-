import type { PRResult } from '@/lib/hooks/usePRDetection';

export type PRCelebrationTier = 'full' | 'sheet' | 'none';

/**
 * Decides which celebration UI to show for a PR.
 *
 * - first_session (first time on this machine) → full-screen overlay (Tier 1)
 * - weight / volume PR → bottom sheet (Tier 2)
 */
export function getPRCelebrationTier(pr: PRResult | null): PRCelebrationTier {
  if (!pr) return 'none';
  if (pr.type === 'first_session') return 'full';
  return 'sheet';
}
