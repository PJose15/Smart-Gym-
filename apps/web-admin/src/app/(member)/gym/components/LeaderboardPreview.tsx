'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@nexera/types';

interface LeaderboardPreviewProps {
  memberId: string;
  gymId: string;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  animation: 'slideUpFade 0.4s ease-out 0.1s both',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

const RANK_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
};

export function LeaderboardPreview({ memberId, gymId }: LeaderboardPreviewProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/member/leaderboard?member_id=${memberId}&gym_id=${gymId}&period=weekly&limit=5`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setEntries(data.entries || []);
            setMyRank(data.my_rank);
          }
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [memberId, gymId, retryCount]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Weekly Leaderboard
        </div>
        <Link href="/gym/leaderboard" style={{ fontSize: 12, color: 'var(--accent-hover, #FF2740)', textDecoration: 'none', fontWeight: 600 }}>
          See All
        </Link>
      </div>

      {error ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Couldn&apos;t load the leaderboard.
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full, 9999px)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: 16 }}>
          No activity this week yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(entry => (
            <div key={entry.profile_id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 8px',
              borderRadius: 8,
              backgroundColor: entry.is_current_user ? 'var(--accent-subtle, rgba(224, 20, 47, 0.10))' : 'transparent',
            }}>
              <div style={{ width: 28, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', textAlign: 'center' }}>
                {RANK_MEDALS[entry.rank] || `#${entry.rank}`}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: entry.is_current_user ? 700 : 500, color: entry.is_current_user ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)' }}>
                {entry.full_name}{entry.is_current_user ? ' (You)' : ''}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                {entry.total_points.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {myRank != null && myRank > 5 && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          borderRadius: 8,
          backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          Your rank: <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-hover, #FF2740)' }}>#{myRank}</span>
        </div>
      )}
    </div>
  );
}
