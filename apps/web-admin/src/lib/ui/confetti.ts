/**
 * Legacy confetti entry points — now thin wrappers over the single
 * spec-compliant implementation in components/effects/ConfettiEffect.tsx
 * (DOC_03 Section 11). Prefer importing launchConfetti / ConfettiEffect
 * directly in new code.
 */
import { launchConfetti } from '@/components/effects/ConfettiEffect';

/**
 * PR-style burst rising from the bottom of the viewport
 * (120 particles / 800ms — PR config).
 */
export function launchBottomConfetti(): void {
  launchConfetti('pr', { origin: 'bottom' });
}

/**
 * Light cascade falling from the top of the viewport
 * (40 particles / 800ms — achievement config). Used for leaderboard rank-ups.
 */
export function launchTopConfetti(): void {
  launchConfetti('achievement', { origin: 'top' });
}
