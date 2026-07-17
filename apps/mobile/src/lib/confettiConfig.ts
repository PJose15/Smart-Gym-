/**
 * Confetti configuration + particle generation — pure, testable.
 * DOC_03 Section 11 (configs) + Section 20 (performance: max 120 particles).
 */
import { colors } from '../theme/colors';

export type ConfettiVariant = 'pr' | 'achievement' | 'levelup';
export type ConfettiShape = 'square' | 'circle' | 'ribbon';

export interface ConfettiConfig {
  count: number;
  duration: number;
  /** Horizontal spread in degrees */
  spread: number;
  /** Initial upward velocity (arbitrary units, scales peak height) */
  startVelocity: number;
  colors: string[];
  shapes: ConfettiShape[];
  /** Downward pull 0–1 (scales fall distance) */
  gravity: number;
}

/** Hard performance cap — DOC_03 Section 20. */
export const MAX_CONFETTI_PARTICLES = 120;

export const CONFETTI_CONFIGS: Record<ConfettiVariant, ConfettiConfig> = {
  pr: {
    count: 120,
    duration: 800,
    spread: 60,
    startVelocity: 35,
    colors: [colors.primary, colors.success, colors.gold, colors.error, colors.info, colors.white],
    shapes: ['square', 'circle', 'ribbon'],
    gravity: 0.8,
  },
  achievement: {
    count: 40,
    duration: 800,
    spread: 40,
    startVelocity: 25,
    colors: [colors.primary, colors.gold, colors.white],
    shapes: ['circle', 'square'],
    gravity: 0.7,
  },
  levelup: {
    count: 80,
    duration: 1000,
    spread: 80,
    startVelocity: 30,
    colors: [colors.primary, colors.primaryLight, colors.gold, colors.white],
    shapes: ['square', 'circle'],
    gravity: 0.75,
  },
};

export interface ConfettiParticle {
  key: number;
  color: string;
  shape: ConfettiShape;
  size: number;
  /** Horizontal start offset as a fraction of container width (-0.5..0.5) */
  startXRatio: number;
  /** Total horizontal drift in px over the animation */
  driftX: number;
  /** Peak rise height in px (negative = up) */
  peakY: number;
  /** Fall distance in px below start point */
  fallY: number;
  /** Total rotation in degrees over the animation */
  rotation: number;
  /** 0–1 stagger of when this particle's motion effectively begins */
  delayRatio: number;
}

/**
 * Generates the particle set for a variant. Random by default; pass a seeded
 * `random` fn for deterministic output (tests).
 */
export function generateParticles(
  variant: ConfettiVariant,
  random: () => number = Math.random,
): ConfettiParticle[] {
  const config = CONFETTI_CONFIGS[variant];
  const count = Math.min(config.count, MAX_CONFETTI_PARTICLES);
  const particles: ConfettiParticle[] = [];

  for (let i = 0; i < count; i++) {
    const spreadRatio = config.spread / 90; // 0..1 of a quarter circle
    particles.push({
      key: i,
      color: config.colors[Math.floor(random() * config.colors.length)] ?? config.colors[0],
      shape: config.shapes[Math.floor(random() * config.shapes.length)] ?? config.shapes[0],
      size: 6 + random() * 6,
      startXRatio: (random() - 0.5) * 0.4,
      driftX: (random() - 0.5) * 2 * spreadRatio * 220,
      peakY: -(config.startVelocity * (4 + random() * 4)),
      fallY: config.gravity * (260 + random() * 200),
      rotation: (random() - 0.5) * 720,
      delayRatio: random() * 0.25,
    });
  }

  return particles;
}
