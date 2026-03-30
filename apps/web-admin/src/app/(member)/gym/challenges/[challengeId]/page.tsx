'use client';

import { CSSProperties, useEffect, useState, use } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import type { ChallengeDetail } from '@nexera/types';

const RANK_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
};

const CHALLENGE_ICONS: Record<string, string> = {
  volume: '\uD83C\uDFCB\uFE0F',
  sessions: '\uD83D\uDCAA',
  pr: '\uD83C\uDFC6',
  streak: '\uD83D\uDD25',
  machine_explorer: '\uD83D\uDDFA\uFE0F',
  team: '\uD83E\uDD1D',
  custom: '\uD83C\uDFAF',
};

const joinBtnStyle: CSSProperties = {
  width: '100%',
  padding: '14px 0',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#3B82F6',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 16,
};

interface PageProps {
  params: Promise<{ challengeId: string }>;
}

export default function ChallengeDetailPage({ params }: PageProps) {
  const { challengeId } = use(params);
  const { member, gym } = useMember();
  const [data, setData] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/member/challenges/${challengeId}?member_id=${member.id}`);
        if (res.ok) setData(await res.json());
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, [member, challengeId]);

  async function handleJoin() {
    if (!member || !gym) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/member/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id, gym_id: gym.id }),
      });
      if (res.ok && data) {
        setData({ ...data, is_joined: true });
      }
    } catch { /* silent */ } finally {
      setJoining(false);
    }
  }

  if (!member || loading) {
    return <div style={{ padding: 16, textAlign: 'center', color: '#64748B', paddingTop: 60 }}>Loading...</div>;
  }

  if (!data) {
    return <div style={{ padding: 16, textAlign: 'center', color: '#94A3B8', paddingTop: 60 }}>Challenge not found</div>;
  }

  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {CHALLENGE_ICONS[data.challenge_type] || '\uD83C\uDFAF'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
          {data.title}
        </h1>
        {data.description && (
          <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8, lineHeight: 1.5 }}>
            {data.description}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <StatChip label="Participants" value={String(data.total_participants)} />
        <StatChip label="Days Left" value={String(data.days_left)} />
        <StatChip label="Top Score" value={data.top_score.toLocaleString()} />
        {data.is_joined && data.my_participation && (
          <StatChip label="Your Rank" value={`#${data.my_participation.current_rank}`} highlight />
        )}
      </div>

      {/* Prize info */}
      {data.prize_description && (
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          border: '1px solid rgba(234, 179, 8, 0.2)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#EAB308', textTransform: 'uppercase', marginBottom: 4 }}>
            Prize
          </div>
          <div style={{ fontSize: 14, color: '#F1F5F9' }}>{data.prize_description}</div>
        </div>
      )}

      {/* Join button */}
      {!data.is_joined && data.is_active && (
        <button style={joinBtnStyle} onClick={handleJoin} disabled={joining}>
          {joining ? 'Joining...' : 'Join Challenge'}
        </button>
      )}

      {/* Participant leaderboard */}
      <div style={{ marginTop: 24 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}>
          Participant Rankings
        </div>

        {data.participants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 14 }}>
            No participants yet. Be the first to join!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data.participants.map(p => {
              const isCurrent = p.member_id === member?.id;
              return (
                <div
                  key={p.member_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  }}
                >
                  <div style={{ width: 28, fontSize: 14, fontWeight: 700, color: '#94A3B8', textAlign: 'center' }}>
                    {RANK_MEDALS[p.current_rank] || `#${p.current_rank}`}
                  </div>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#94A3B8',
                    }}>
                      {p.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, fontSize: 14, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#60A5FA' : '#E2E8F0' }}>
                    {p.display_name}{isCurrent ? ' (You)' : ''}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
                    {p.current_score.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      backgroundColor: highlight ? 'rgba(59, 130, 246, 0.1)' : '#1E293B',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: highlight ? '#60A5FA' : '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginTop: 2 }}>{value}</div>
    </div>
  );
}
