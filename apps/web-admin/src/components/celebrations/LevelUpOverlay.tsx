'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { ConfettiEffect } from '@/components/effects/ConfettiEffect';

interface LevelUpOverlayProps {
  level: number;
  name: string;
  color: string;
  onDismiss: () => void;
  /** Perks unlocked at this level — rendered as a staggered list (50ms each) */
  perks?: string[];
  /** XP progress (0-100) carried into the bar animation. Bar resets to 0% at the new level. */
  previousProgressPct?: number;
}

const CONFETTI_AT_MS = 1300;

/**
 * Level-up celebration — DOC_03 Section 12.
 *
 * 7-phase sequence (CSS-driven, Tier-3 timings):
 *   1. 0–400ms    overlay slides up from bottom (sheet style)
 *   2. 200–700ms  level badge scales in (spring, 500ms)
 *   3. 600ms      "LEVEL [N]" appears with glow
 *   4. 700ms      level name appears
 *   5. 900ms      XP bar animates from old % to 0% at new level
 *   6. 1100ms+    perks list, staggered 50ms each
 *   7. 1300ms     confetti burst (level-up config)
 *   NO auto-dismiss — level-up is special. Tap to dismiss.
 */
export function LevelUpOverlay({
  level,
  name,
  color,
  onDismiss,
  perks = [],
  previousProgressPct = 100,
}: LevelUpOverlayProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), CONFETTI_AT_MS);
    return () => clearTimeout(timer);
  }, [level]);

  const badgeStyle: CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 44,
    fontWeight: 800,
    fontFamily: 'var(--font-mono)',
    color,
    backgroundColor: 'var(--bg-card)',
    border: `3px solid ${color}`,
    boxShadow: `0 0 40px color-mix(in srgb, ${color} 45%, transparent)`,
  };

  return (
    <div
      className="level-up-overlay"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-celebration)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--page-padding-x)',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: 'rgba(13, 13, 15, 0.95)',
      }}
    >
      {/* Phase 1: sheet slides up carrying all content */}
      <div className="lu-sheet" style={{ width: '100%', maxWidth: 360 }}>
        {/* Phase 2: badge spring */}
        <div className="lu-badge" style={badgeStyle} aria-hidden="true">
          {level}
        </div>

        {/* Phase 3: LEVEL [N] with glow */}
        <div
          className="lu-level-text"
          style={{
            marginTop: 'var(--space-6)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wider)',
            textShadow: `0 0 24px color-mix(in srgb, ${color} 60%, transparent)`,
          }}
        >
          Level {level}
        </div>

        {/* Phase 4: level name */}
        <div
          className="lu-name"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 800,
            color,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wide)',
          }}
        >
          {name}
        </div>

        {/* Phase 5: XP bar drains from old progress to 0% at the new level */}
        <div
          className="lu-xp-track"
          aria-hidden="true"
          style={{
            marginTop: 'var(--space-6)',
            height: 6,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-card-hover)',
            overflow: 'hidden',
          }}
        >
          <div
            className="lu-xp-fill"
            style={
              {
                height: '100%',
                backgroundColor: color,
                borderRadius: 'var(--radius-full)',
                transformOrigin: 'left',
                '--from-scale': `${Math.min(Math.max(previousProgressPct, 0), 100) / 100}`,
              } as CSSProperties
            }
          />
        </div>

        {/* Phase 6: perks unlocked, staggered 50ms each */}
        {perks.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              marginTop: 'var(--space-6)',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {perks.map((perk, i) => (
              <li
                key={perk}
                className="lu-perk"
                style={
                  {
                    '--perk-index': i,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                  } as CSSProperties
                }
              >
                <span aria-hidden="true" style={{ color: 'var(--success)' }}>
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>
        )}

        <p
          className="lu-hint"
          style={{
            margin: 0,
            marginTop: 'var(--space-8)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-disabled)',
          }}
        >
          Tap to continue
        </p>
      </div>

      {/* Phase 7: level-up confetti */}
      {showConfetti && <ConfettiEffect variant="levelup" origin="bottom" />}
    </div>
  );
}
