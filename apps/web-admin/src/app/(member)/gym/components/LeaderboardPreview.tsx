'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@nexera/types';

interface LeaderboardPreviewProps {
  memberId: string;
  gymId: string;
}

const cardStyle: CSSProperties = {
  backgroundColor: '#1E293B',
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/member/leaderboard?member_id=${memberId}&gym_id=${gymId}&period=weekly&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
          setMyRank(data.my_rank);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId, gymId]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748B' }}>Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Weekly Leaderboard
        </div>
        <Link href="/gym/leaderboard" style={{ fontSize: 12, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>
          See All
        </Link>
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: 16 }}>
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
              backgroundColor: entry.is_current_user ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}>
              <div style={{ width: 28, fontSize: 14, fontWeight: 700, color: '#F1F5F9', textAlign: 'center' }}>
                {RANK_MEDALS[entry.rank] || `#${entry.rank}`}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: entry.is_current_user ? 700 : 500, color: entry.is_current_user ? '#60A5FA' : '#CBD5E1' }}>
                {entry.full_name}{entry.is_current_user ? ' (You)' : ''}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
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
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fontSize: 13,
          color: '#94A3B8',
          textAlign: 'center',
        }}>
          Your rank: <span style={{ fontWeight: 700, color: '#60A5FA' }}>#{myRank}</span>
        </div>
      )}
    </div>
  );
}
