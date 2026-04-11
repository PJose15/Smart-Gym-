'use client';

import { useEffect, useState } from 'react';
import type { PRResult } from '@/lib/hooks/usePRDetection';
import { formatWeight, convertFromLbs, type WeightUnit } from '@/lib/weight';

const PR_LABELS: Record<string, string> = {
  first_session: 'FIRST TIME!',
  weight: 'WEIGHT PR!',
  volume: 'VOLUME PR!',
};

const PR_MESSAGES: Record<string, string> = {
  first_session: "You're off to a great start!",
  weight: "You just crushed your personal best!",
  volume: "Biggest session on this machine ever!",
};

interface PRCelebrationProps {
  pr: PRResult;
  machineName: string;
  onDismiss: () => void;
  /** Display unit for weight values. PRResult values are always in lbs. */
  weightUnit?: WeightUnit;
}

export function PRCelebration({ pr, machineName, onDismiss, weightUnit = 'lbs' }: PRCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Entrance animation
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleTap = () => {
    setExiting(true);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      onClick={handleTap}
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
        background: `radial-gradient(ellipse at center,
          rgba(239, 159, 39, 0.15) 0%,
          var(--color-bg-base) 70%)`,
        backdropFilter: 'blur(8px)',
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: `opacity 0.4s var(--ease-out)`,
      }}
    >
      {/* Gold burst icon */}
      <div
        style={{
          fontSize: 64,
          marginBottom: 'var(--space-4)',
          transform: visible && !exiting ? 'scale(1)' : 'scale(0.3)',
          opacity: visible && !exiting ? 1 : 0,
          transition: `transform 0.6s var(--ease-celebration), opacity 0.3s var(--ease-out)`,
          filter: 'drop-shadow(0 0 20px rgba(239, 159, 39, 0.5))',
        }}
      >
        {pr.type === 'first_session' ? '🎉' : '🏆'}
      </div>

      {/* PR type label */}
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-gold)',
          letterSpacing: 'var(--tracking-wide)',
          textShadow: '0 0 30px rgba(239, 159, 39, 0.4)',
          marginBottom: 'var(--space-2)',
          transform: visible && !exiting ? 'translateY(0)' : 'translateY(20px)',
          opacity: visible && !exiting ? 1 : 0,
          transition: `all 0.5s var(--ease-out) 0.15s`,
        }}
      >
        {PR_LABELS[pr.type] || 'NEW PR!'}
      </h2>

      {/* Machine name */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-4)',
          transform: visible && !exiting ? 'translateY(0)' : 'translateY(12px)',
          opacity: visible && !exiting ? 1 : 0,
          transition: `all 0.4s var(--ease-out) 0.25s`,
        }}
      >
        {machineName}
      </p>

      {/* Value + improvement */}
      <div
        style={{
          transform: visible && !exiting ? 'translateY(0)' : 'translateY(12px)',
          opacity: visible && !exiting ? 1 : 0,
          transition: `all 0.4s var(--ease-out) 0.35s`,
        }}
      >
        {pr.type !== 'first_session' && (
          <div
            style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--weight-bold)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {formatWeight(pr.value, weightUnit)}
          </div>
        )}

        {pr.previousValue !== null && pr.improvementPct !== null && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-gold)',
            }}
          >
            +{convertFromLbs(pr.value - pr.previousValue, weightUnit).toFixed(
              weightUnit === 'kg' ? 1 : 0
            )} {weightUnit} (+{pr.improvementPct}%)
          </p>
        )}

        <p
          style={{
            margin: 0,
            marginTop: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {PR_MESSAGES[pr.type] || 'Incredible effort!'}
        </p>
      </div>

      {/* Tap to dismiss */}
      <p
        style={{
          position: 'absolute',
          bottom: 'var(--space-8)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-disabled)',
          opacity: visible && !exiting ? 1 : 0,
          transition: `opacity 0.4s var(--ease-out) 0.8s`,
        }}
      >
        Tap to dismiss
      </p>
    </div>
  );
}
