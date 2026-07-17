/**
 * Confetti system parameters — DOC_03 Section 11.
 * Pure config module (no DOM) so tier/config selection is unit-testable.
 */

export type ConfettiShape = 'square' | 'circle' | 'ribbon';

export type ConfettiVariant = 'pr' | 'achievement' | 'levelup';

export interface ConfettiConfig {
  /** number of particles */
  count: number;
  /** total animation duration in ms */
  duration: number;
  /** horizontal spread in degrees */
  spread: number;
  /** initial upward velocity */
  startVelocity: number;
  /** particle colors */
  colors: string[];
  shapes: ConfettiShape[];
  /** downward pull (0-1) */
  gravity: number;
}

/** Performance budget — DOC_03 §20: max 120 particles on mid-range devices */
export const MAX_CONFETTI_PARTICLES = 120;

/** PR Celebration confetti — 0.8s cascade */
export const PR_CONFETTI: ConfettiConfig = {
  count: 120,
  duration: 800,
  spread: 60,
  startVelocity: 35,
  colors: ['#7C5CFF', '#00C896', '#FFD700', '#FF4D6A', '#3B82F6', '#FFFFFF'],
  shapes: ['square', 'circle', 'ribbon'],
  gravity: 0.8,
};

/** Achievement unlock confetti (lighter, more focused) */
export const ACHIEVEMENT_CONFETTI: ConfettiConfig = {
  count: 40,
  duration: 800,
  spread: 40,
  startVelocity: 25,
  colors: ['#7C5CFF', '#FFD700', '#FFFFFF'],
  shapes: ['circle', 'square'],
  gravity: 0.7,
};

/** Level-up confetti */
export const LEVEL_UP_CONFETTI: ConfettiConfig = {
  count: 80,
  duration: 1000,
  spread: 80,
  startVelocity: 30,
  colors: ['#7C5CFF', '#9070FF', '#FFD700', '#FFFFFF'],
  shapes: ['square', 'circle'],
  gravity: 0.75,
};

const CONFIGS: Record<ConfettiVariant, ConfettiConfig> = {
  pr: PR_CONFETTI,
  achievement: ACHIEVEMENT_CONFETTI,
  levelup: LEVEL_UP_CONFETTI,
};

/**
 * Resolve a variant to its config, enforcing the 120-particle budget
 * (defensive clamp — configs above already comply).
 */
export function getConfettiConfig(variant: ConfettiVariant): ConfettiConfig {
  const config = CONFIGS[variant];
  if (config.count <= MAX_CONFETTI_PARTICLES) return config;
  return { ...config, count: MAX_CONFETTI_PARTICLES };
}
