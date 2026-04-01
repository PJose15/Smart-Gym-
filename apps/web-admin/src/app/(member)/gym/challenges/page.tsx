'use client';

import { CSSProperties, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMember } from '@/lib/contexts/MemberContext';
import type { ChallengeListItem } from '@nexera/types';

type Tab = 'active' | 'completed';

const toggleContainerStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 0,
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 3,
  marginBottom: 16,
};

function toggleBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: active ? 'var(--color-blue)' : 'transparent',
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    transition: 'all 0.2s',
  };
}

const CHALLENGE_ICONS: Record<string, string> = {
  volume: '\uD83C\uDFCB\uFE0F',
  sessions: '\uD83D\uDCAA',
  pr: '\uD83C\uDFC6',
  streak: '\uD83D\uDD25',
  machine_explorer: '\uD83D\uDDFA\uFE0F',
  team: '\uD83E\uDD1D',
  custom: '\uD83C\uDFAF',
};

export default function ChallengesListPage() {
  const { member, gym } = useMember();
  const [tab, setTab] = useState<Tab>('active');
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (!member || !gym) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/member/challenges?member_id=${member.id}&gym_id=${gym.id}`);
        if (res.ok) {
          const data = await res.json();
          setChallenges(data.challenges || []);
        }
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, [member, gym]);

  async function handleJoin(challengeId: string) {
    if (!member || !gym) return;
    setJoining(challengeId);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id, gym_id: gym.id }),
      });
      if (res.ok) {
        setChallenges(prev => prev.map(c =>
          c.challenge_id === challengeId ? { ...c, is_joined: true } : c
        ));
      }
    } catch { /* silent */ } finally {
      setJoining(null);
    }
  }

  if (!member || !gym) {
    return <div style={{ padding: 16, color: 'var(--color-text-secondary)' }}>Loading...</div>;
  }

  const filtered = challenges.filter(c => tab === 'active' ? c.is_active : !c.is_active);

  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)', paddingBottom: 100 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, marginBottom: 16 }}>
        Challenges
      </h1>

      <div style={toggleContainerStyle}>
        <button style={toggleBtnStyle(tab === 'active')} onClick={() => setTab('active')}>Active</button>
        <button style={toggleBtnStyle(tab === 'completed')} onClick={() => setTab('completed')}>Completed</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)', fontSize: 14 }}>
          No {tab} challenges right now.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => (
            <Link
              key={c.challenge_id}
              href={`/gym/challenges/${c.challenge_id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: 'var(--color-bg-raised)',
                borderRadius: 12,
                padding: 16,
                transition: 'transform 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>
                      {CHALLENGE_ICONS[c.challenge_type] || '\uD83C\uDFAF'}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.title}</div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                          {c.description.length > 80 ? c.description.slice(0, 80) + '...' : c.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {!c.is_joined && c.is_active && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleJoin(c.challenge_id); }}
                      disabled={joining === c.challenge_id}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: 'var(--color-blue)',
                        color: 'var(--color-text-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {joining === c.challenge_id ? '...' : 'Join'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  <span>{c.total_participants} participant{c.total_participants !== 1 ? 's' : ''}</span>
                  {c.is_active && <span>{c.days_left}d left</span>}
                  <span>Top: {c.top_score.toLocaleString()}</span>
                </div>

                {c.is_joined && (
                  <div style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>Joined</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      Score: {(c.my_score ?? 0).toLocaleString()} &middot; Rank #{c.rank}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
