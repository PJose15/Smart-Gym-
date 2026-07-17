'use client';

import { useId } from 'react';
import { getStreakTier, STREAK_TIER_CONFIG } from './streakTier';

interface StreakFlameProps {
  /** Current streak in days. If your streak is measured in weeks, pass weeks * 7. */
  streakDays: number;
  /** Override the tier-defined size (px width; height = size * 1.3) */
  size?: number;
  /** Disable the drop-shadow glow (defaults to on) */
  showGlow?: boolean;
}

/**
 * The 6-tier animated SVG streak flame — DOC_03 Section 8.
 * Replaces the 🔥 emoji. Sway (rotate) lives on the wrapper, flicker
 * (scale) on the SVG so the two transforms never conflict.
 * Purely decorative — always render the streak number alongside it.
 */
export function StreakFlame({ streakDays, size, showGlow = true }: StreakFlameProps) {
  const tier = getStreakTier(streakDays);
  const config = STREAK_TIER_CONFIG[tier];
  const gradId = useId().replace(/:/g, '');
  const width = size ?? config.size;
  const height = Math.round(width * 1.3);

  return (
    <span
      className="streak-flame-root"
      data-tier={tier}
      aria-hidden="true"
      style={
        {
          display: 'inline-block',
          lineHeight: 0,
          '--sway-speed': `${config.swaySpeed}ms`,
          '--amplitude': `${config.amplitude}deg`,
          '--flicker-speed': `${config.flickerSpeed}ms`,
          '--glow-size': showGlow ? `${config.glowSize}px` : '0px',
          '--glow-color': showGlow ? config.glowColor : 'transparent',
        } as React.CSSProperties
      }
    >
      <svg
        className="streak-flame"
        width={width}
        height={height}
        viewBox="0 0 24 32"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id={`flameGrad-${gradId}`} cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity={0.9} />
            <stop offset="40%" stopColor={config.color} stopOpacity={1} />
            <stop
              offset="100%"
              stopColor={tier === 5 ? '#9C00FF' : tier === 0 ? 'var(--streak-cold, #606070)' : '#FF3D00'}
              stopOpacity={0.8}
            />
          </radialGradient>
        </defs>
        {/* Flame path — outer shape (from DOC_03 §8) */}
        <path
          d="M12 2 C12 2 8 8 6 14 C4 20 6 24 8 26 C10 28 12 28 12 28 C12 28 14 28 16 26 C18 24 20 20 18 14 C16 8 12 2 12 2Z"
          fill={`url(#flameGrad-${gradId})`}
        />
        {/* Inner core — brighter center */}
        <path
          d="M12 14 C12 14 10 18 10 22 C10 24 11 26 12 26 C13 26 14 24 14 22 C14 18 12 14 12 14Z"
          fill="white"
          opacity={tier === 0 ? 0.25 : 0.6}
        />
        {/* Tier 5 — legend particles (purple sparkles) */}
        {config.particles && (
          <>
            <path d="M8 8 L9 6 L10 8 L8 8Z" fill="#E040FB" opacity={0.8} />
            <path d="M16 10 L17 8 L18 10 L16 10Z" fill="#EA80FC" opacity={0.7} />
            <path d="M12 4 L13 2 L14 4 L12 4Z" fill="#CE93D8" opacity={0.9} />
          </>
        )}
      </svg>
    </span>
  );
}
