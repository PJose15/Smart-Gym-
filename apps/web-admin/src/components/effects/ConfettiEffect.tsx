'use client';

import { useEffect, useRef } from 'react';
import {
  getConfettiConfig,
  MAX_CONFETTI_PARTICLES,
  type ConfettiConfig,
  type ConfettiVariant,
} from './confettiConfigs';

export {
  PR_CONFETTI,
  ACHIEVEMENT_CONFETTI,
  LEVEL_UP_CONFETTI,
  MAX_CONFETTI_PARTICLES,
  getConfettiConfig,
} from './confettiConfigs';
export type { ConfettiConfig, ConfettiShape, ConfettiVariant } from './confettiConfigs';

export type ConfettiOrigin = 'bottom' | 'center' | 'top';

interface LaunchOptions {
  /**
   * bottom — burst up from the lower-center of the viewport (PR / level-up)
   * center — focused burst from mid-screen (achievement badge)
   * top    — cascade falling from the top edge (leaderboard rank-up)
   */
  origin?: ConfettiOrigin;
}

/** px-per-second scale applied to config.startVelocity */
const VELOCITY_SCALE = 25;
/** px-per-second² scale applied to config.gravity */
const GRAVITY_SCALE = 2200;

interface SpawnPoint {
  leftPct: number;
  topPct: number;
  angleDeg: number; // 0 = right, -90 = up, 90 = down
}

function getSpawn(origin: ConfettiOrigin, spread: number): SpawnPoint {
  const jitter = (range: number) => (Math.random() - 0.5) * range;
  switch (origin) {
    case 'top':
      // Fall from anywhere along the top edge
      return { leftPct: Math.random() * 100, topPct: -2, angleDeg: 90 + jitter(spread) };
    case 'center':
      return { leftPct: 50 + jitter(10), topPct: 45, angleDeg: -90 + jitter(spread) };
    case 'bottom':
    default:
      return { leftPct: 50 + jitter(16), topPct: 88, angleDeg: -90 + jitter(spread) };
  }
}

/**
 * Single confetti implementation for web-admin — DOC_03 Section 11.
 *
 * DOM particles animated with a shared CSS keyframe (`confettiBurst` in
 * animations.css). Each particle's ballistic arc (velocity + gravity) is
 * pre-computed into CSS custom properties, so the browser only animates
 * transform/opacity (GPU-composited, per the §20 performance budget).
 *
 * No-ops entirely under prefers-reduced-motion and during SSR.
 */
export function launchConfetti(
  variantOrConfig: ConfettiVariant | ConfettiConfig,
  options: LaunchOptions = {}
): void {
  if (typeof document === 'undefined') return;

  // Respect reduced motion — render nothing
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const config =
    typeof variantOrConfig === 'string' ? getConfettiConfig(variantOrConfig) : variantOrConfig;
  const origin = options.origin ?? 'bottom';
  const count = Math.min(config.count, MAX_CONFETTI_PARTICLES);
  const durationSec = config.duration / 1000;
  const maxDelayMs = Math.round(config.duration * 0.15);

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: 'var(--z-celebration, 600)',
    overflow: 'hidden',
  });

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];
    const spawn = getSpawn(origin, config.spread);

    // Ballistic arc: x(t) = vx·t, y(t) = vy·t + ½g·t²  (y grows downward)
    const speed = config.startVelocity * VELOCITY_SCALE * (0.6 + Math.random() * 0.8);
    const rad = (spawn.angleDeg * Math.PI) / 180;
    const vx = Math.cos(rad) * speed;
    const vy = Math.sin(rad) * speed;
    const g = config.gravity * GRAVITY_SCALE;

    const pos = (t: number) => ({
      x: vx * t,
      y: vy * t + 0.5 * g * t * t,
    });
    const mid = pos(durationSec / 2);
    const end = pos(durationSec);

    const rotEnd = Math.random() * 720 - 360;
    const size = 6 + Math.random() * 5;
    const delay = Math.random() * maxDelayMs;

    Object.assign(piece.style, {
      position: 'absolute',
      top: `${spawn.topPct}vh`,
      left: `${spawn.leftPct}%`,
      width: `${size}px`,
      height: shape === 'ribbon' ? `${size * 2.6}px` : `${size}px`,
      backgroundColor: color,
      borderRadius: shape === 'circle' ? '50%' : '2px',
      willChange: 'transform, opacity',
      animation: `confettiBurst ${config.duration}ms linear ${delay}ms both`,
      ['--cx-mid' as string]: `${mid.x.toFixed(0)}px`,
      ['--cy-mid' as string]: `${mid.y.toFixed(0)}px`,
      ['--cx-end' as string]: `${end.x.toFixed(0)}px`,
      ['--cy-end' as string]: `${end.y.toFixed(0)}px`,
      ['--rot-mid' as string]: `${(rotEnd / 2).toFixed(0)}deg`,
      ['--rot-end' as string]: `${rotEnd.toFixed(0)}deg`,
    });

    container.appendChild(piece);
  }

  document.body.appendChild(container);

  setTimeout(() => {
    try {
      container.remove();
    } catch {
      /* already removed */
    }
  }, config.duration + maxDelayMs + 100);
}

interface ConfettiEffectProps {
  variant: ConfettiVariant;
  origin?: ConfettiOrigin;
  /** Fires after the burst completes (or immediately-ish under reduced motion) */
  onComplete?: () => void;
}

/**
 * Declarative wrapper — fires one confetti burst on mount.
 * Renders nothing itself; particles are managed imperatively so
 * unmounting mid-burst never cuts the animation short.
 */
export function ConfettiEffect({ variant, origin, onComplete }: ConfettiEffectProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    launchConfetti(variant, { origin });
    const duration = getConfettiConfig(variant).duration;
    const timer = setTimeout(() => onCompleteRef.current?.(), duration + 200);
    return () => clearTimeout(timer);
  }, [variant, origin]);

  return null;
}
