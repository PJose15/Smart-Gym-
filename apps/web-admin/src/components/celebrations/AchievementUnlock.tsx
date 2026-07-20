'use client';

import { useEffect, useRef, useState, CSSProperties } from 'react';
import { ConfettiEffect } from '@/components/effects/ConfettiEffect';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementUnlockData {
  id: string;
  name: string;
  description: string;
  /** emoji or icon character shown inside the 120px badge */
  icon: string;
  points: number;
  rarity: AchievementRarity;
}

interface AchievementUnlockProps {
  achievement: AchievementUnlockData;
  onDismiss: () => void;
}

/** Rarity border colors — DOC_03 §9 (token-backed where a token exists) */
const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: 'var(--text-tertiary, #6B6870)',
  rare: 'var(--info, #3B82F6)',
  epic: 'var(--accent, #E0142F)',
  legendary: 'var(--gold, #E8B339)',
};

/** Rarity glow intensity — DOC_03 §9 */
const RARITY_GLOW: Record<AchievementRarity, string> = {
  common: '0 0 16px rgba(107,104,112,0.3)',
  rare: '0 0 24px rgba(59,130,246,0.4)',
  epic: '0 0 32px rgba(224,20,47,0.5)',
  legendary: '0 0 48px rgba(232,179,57,0.6)',
};

/**
 * Rarity is not stored on badges yet — approximate it from the XP value
 * (spec: difficulty is "based on points value").
 */
export function deriveRarityFromPoints(points: number): AchievementRarity {
  if (points >= 200) return 'legendary';
  if (points >= 100) return 'epic';
  if (points >= 50) return 'rare';
  return 'common';
}

const CONFETTI_AT_MS = 1500;
const AUTO_DISMISS_MS = 2500;

/**
 * Full-screen achievement unlock takeover — DOC_03 Section 9.
 *
 * 8-phase timeline (all entrance animations are CSS, defined in
 * animations.css with `both` fill so reduced-motion collapses to the
 * final visible state):
 *   1. 0–300ms    overlay fades in
 *   2. 200–700ms  badge springs up (scale 0 → 1.1)
 *   3. 600–900ms  badge settles (1.1 → 1.0)
 *   4. 700ms      name slides up
 *   5. 900ms      description fades in
 *   6. 1100ms     XP badge pops in
 *   7. 1500ms     light confetti burst (40 particles)
 *   8. 2500ms     auto-dismiss (or tap anytime)
 */
export function AchievementUnlock({ achievement, onDismiss }: AchievementUnlockProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const confettiTimer = setTimeout(() => setShowConfetti(true), CONFETTI_AT_MS);
    const dismissTimer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(dismissTimer);
    };
  }, [achievement.id]);

  const rarityColor = RARITY_COLORS[achievement.rarity];
  const rarityGlow = RARITY_GLOW[achievement.rarity];

  const badgeStyle: CSSProperties = {
    width: 120,
    height: 120,
    borderRadius: 24,
    background:
      achievement.rarity === 'legendary'
        ? 'linear-gradient(135deg, var(--bg-card, #16161A) 0%, var(--bg-warning-subtle, #261D0A) 100%)'
        : 'var(--bg-card, #16161A)',
    border: `3px solid ${rarityColor}`,
    boxShadow: rarityGlow,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 56,
    margin: '0 auto',
  };

  return (
    <div
      className="achievement-unlock"
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
      {/* Phase 2+3: badge spring + settle */}
      <div className="au-badge achievement-badge" data-rarity={achievement.rarity} style={badgeStyle} aria-hidden="true">
        {achievement.icon}
      </div>

      {/* Phase 4: name slides up */}
      <h2
        className="au-name"
        style={{
          margin: 0,
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        {achievement.name}
      </h2>

      {/* Phase 5: description fades in */}
      {achievement.description && (
        <p
          className="au-desc"
          style={{
            margin: 0,
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            maxWidth: 280,
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {achievement.description}
        </p>
      )}

      {/* Phase 6: XP pop */}
      <div
        className="au-xp"
        style={{
          marginTop: 'var(--space-5)',
          padding: '6px 16px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--accent-subtle)',
          border: '1px solid var(--border-accent)',
          color: 'var(--xp-color, #E0142F)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-bold)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        +{achievement.points} XP
      </div>

      {/* Phase 7: light focused confetti */}
      {showConfetti && <ConfettiEffect variant="achievement" origin="center" />}

      <p
        className="au-hint"
        style={{
          position: 'absolute',
          bottom: 'var(--space-8)',
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-disabled)',
        }}
      >
        Tap to dismiss
      </p>
    </div>
  );
}
