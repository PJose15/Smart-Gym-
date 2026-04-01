'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChallengeListItem } from '@nexera/types';

interface ChallengePreviewProps {
  memberId: string;
  gymId: string;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  animation: 'slideUpFade 0.4s ease-out 0.2s both',
};

const challengeCardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-base)',
  borderRadius: 10,
  padding: 12,
};

const joinBtnStyle: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  backgroundColor: 'var(--color-blue)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const joinedBadgeStyle: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  backgroundColor: 'var(--color-green-light)',
  color: 'var(--color-green)',
  fontSize: 11,
  fontWeight: 600,
};

export function ChallengePreview({ memberId, gymId }: ChallengePreviewProps) {
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/member/challenges?member_id=${memberId}&gym_id=${gymId}`);
        if (res.ok) {
          const data = await res.json();
          setChallenges((data.challenges || []).filter((c: ChallengeListItem) => c.is_active).slice(0, 3));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId, gymId]);

  async function handleJoin(challengeId: string) {
    setJoining(challengeId);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, gym_id: gymId }),
      });
      if (res.ok) {
        setChallenges(prev => prev.map(c =>
          c.challenge_id === challengeId ? { ...c, is_joined: true } : c
        ));
      }
    } catch {
      // silent
    } finally {
      setJoining(null);
    }
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading challenges...</div>
        </div>
      </div>
    );
  }

  if (challenges.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Challenges
        </div>
        <Link href="/gym/challenges" style={{ fontSize: 12, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>
          See All
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {challenges.map(c => (
          <div key={c.challenge_id} style={challengeCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {c.days_left} day{c.days_left !== 1 ? 's' : ''} left &middot; {c.total_participants} participant{c.total_participants !== 1 ? 's' : ''}
                </div>
              </div>
              {c.is_joined ? (
                <span style={joinedBadgeStyle}>Joined</span>
              ) : (
                <button
                  type="button"
                  style={joinBtnStyle}
                  onClick={() => handleJoin(c.challenge_id)}
                  disabled={joining === c.challenge_id}
                >
                  {joining === c.challenge_id ? '...' : 'Join'}
                </button>
              )}
            </div>
            {c.is_joined && c.my_score != null && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Your score: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{c.my_score.toLocaleString()}</span>
                {c.rank > 0 && <span> &middot; Rank #{c.rank}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
