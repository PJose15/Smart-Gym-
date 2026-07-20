'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';
import type { LeaderboardEntry } from '@nexera/types';
import type { RankChange } from '@/hooks/useLeaderboard';
import { haptics } from '@/lib/ui/haptics';
import { launchTopConfetti } from '@/lib/ui/confetti';

const RANK_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
};

export interface AnimatedLeaderboardProps {
  entries: LeaderboardEntry[];
  myRank: number | null;
  totalParticipants: number;
  rankChange: RankChange | null;
  onRankChangeAnimated: () => void;
}

export function AnimatedLeaderboard({
  entries,
  myRank,
  totalParticipants,
  rankChange,
  onRankChangeAnimated,
}: AnimatedLeaderboardProps) {
  const [toastExiting, setToastExiting] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss toast after 3s
  useEffect(() => {
    if (!rankChange) {
      setToastExiting(false);
      return;
    }

    toastTimerRef.current = setTimeout(() => {
      setToastExiting(true);
      // Wait for exit animation then clear
      exitTimerRef.current = setTimeout(() => {
        onRankChangeAnimated();
      }, 250);
    }, 3000);

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [rankChange, onRankChangeAnimated]);

  // Confetti + haptics on rank change
  useEffect(() => {
    if (!rankChange || rankChange.delta <= 0) return;

    haptics.success();

    if (!rankChange.isNewNumber1) return;

    const timer = setTimeout(() => {
      launchTopConfetti();
      haptics.celebration();
    }, 600);

    return () => clearTimeout(timer);
  }, [rankChange]);

  const toastClass = toastExiting ? 'lb-rank-toast lb-rank-toast--exit' : 'lb-rank-toast';

  return (
    <>
      {/* Rank change toast */}
      {rankChange && (
        <div
          className={toastClass}
          role="status"
          aria-live="polite"
          style={toastStyle}
        >
          <span style={{ fontSize: 16 }}>&#8593;</span>{' '}
          You moved up {rankChange.delta} spot{rankChange.delta !== 1 ? 's' : ''}!
        </div>
      )}

      {/* Your Position card */}
      {myRank !== null && (
        <div style={positionCardStyle}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--accent-hover, #FF2740)', fontWeight: 600, textTransform: 'uppercase' as const }}>
              Your Position
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              #{myRank}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            out of {totalParticipants}
          </div>
        </div>
      )}

      {/* Ranked list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((entry, idx) => {
          const isGlow = rankChange && entry.is_current_user;
          const rowClass = isGlow ? 'lb-row-glow' : 'lb-row-animated';

          return (
            <div
              key={`${entry.profile_id}-${entry.rank}`}
              className={rowClass}
              aria-label={isGlow ? `You moved up to rank ${entry.rank}` : undefined}
              style={{
                ...rowStyle(entry.is_current_user),
                ['--row-index' as string]: idx,
              }}
            >
              <div className={isGlow ? 'lb-rank-badge' : undefined} style={rankNumStyle}>
                {RANK_MEDALS[entry.rank] || `#${entry.rank}`}
              </div>
              <div style={avatarStyle}>
                {entry.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={nameStyle(entry.is_current_user)}>
                {entry.full_name}{entry.is_current_user ? ' (You)' : ''}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {entry.total_points.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Inline styles ─────────────────────────────── */

const toastStyle: CSSProperties = {
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  borderRadius: 10,
  padding: '10px 14px',
  marginBottom: 12,
  color: '#6EE7B7',
  fontSize: 14,
  fontWeight: 600,
  textAlign: 'center',
};

const positionCardStyle: CSSProperties = {
  backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid var(--border-accent, rgba(224, 20, 47, 0.28))',
};

function rowStyle(isCurrent: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    backgroundColor: isCurrent ? 'var(--accent-subtle, rgba(224, 20, 47, 0.10))' : 'transparent',
  };
}

const rankNumStyle: CSSProperties = {
  width: 32,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
};

const avatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: 'var(--color-bg-elevated)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  flexShrink: 0,
};

function nameStyle(isCurrent: boolean): CSSProperties {
  return {
    flex: 1,
    fontSize: 14,
    fontWeight: isCurrent ? 700 : 500,
    color: isCurrent ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)',
  };
}
