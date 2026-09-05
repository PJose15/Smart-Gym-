'use client';

import { CSSProperties } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { AnimatedLeaderboard } from '@/components/leaderboard/AnimatedLeaderboard';
import { LeaderboardSkeleton } from '@/components/skeletons';
import { BackButton } from '@/components/nav/BackButton';

const RANK_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',
  2: '\uD83E\uDD48',
  3: '\uD83E\uDD49',
};

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

const podiumStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  gap: 8,
  marginBottom: 24,
  padding: '16px 0',
};

function podiumCardStyle(rank: number, isCurrent: boolean): CSSProperties {
  const heights: Record<number, number> = { 1: 120, 2: 100, 3: 85 };
  const colors: Record<number, string> = { 1: 'var(--gold, #E8B339)', 2: 'var(--silver, #C0C0C0)', 3: 'var(--bronze, #CD7F32)' };
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: rank === 1 ? 100 : 85,
    height: heights[rank] || 80,
    backgroundColor: 'var(--color-bg-raised)',
    borderRadius: 12,
    padding: 10,
    border: isCurrent ? '2px solid var(--accent, #E0142F)' : `2px solid ${colors[rank] || 'var(--color-bg-elevated)'}`,
    order: rank === 1 ? 1 : rank === 2 ? 0 : 2,
  };
}

export default function LeaderboardFullPage() {
  const { member, gym } = useMember();
  const { data, loading, error, period, setPeriod, rankChange, clearRankChange, refresh } = useLeaderboard(
    member?.id || '',
    gym?.id || ''
  );

  if (!member || !gym) {
    return (
      <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)' }}>
        <LeaderboardSkeleton />
      </div>
    );
  }

  const entries = data?.entries || [];
  const topThree = entries.slice(0, 3);
  // Podium needs at least two entries to make visual sense; with a single
  // entry (small gyms / quiet weeks) fall through to the plain ranked list
  // so the lone leader still renders.
  const showPodium = topThree.length >= 2;
  const rest = showPodium ? entries.slice(3) : entries;

  return (
    <div style={{ padding: 'var(--page-padding-x, 16px)', paddingTop: 'var(--space-6, 24px)', paddingBottom: 100 }}>
      <BackButton style={{ marginBottom: 8 }} />
      <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-serif)', color: 'var(--color-text-primary)', margin: 0, marginBottom: 16 }}>
        Leaderboard
      </h1>

      <div style={toggleContainerStyle}>
        <button style={toggleBtnStyle(period === 'weekly')} onClick={() => setPeriod('weekly')}>
          This Week
        </button>
        <button style={toggleBtnStyle(period === 'all_time')} onClick={() => setPeriod('all_time')}>
          All Time
        </button>
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '0 0 16px' }}>
            Couldn&apos;t load the leaderboard. Please try again.
          </p>
          <button
            type="button"
            onClick={refresh}
            style={{
              backgroundColor: 'var(--accent, #E0142F)',
              color: 'var(--text-on-accent, #FFFFFF)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)', fontSize: 14 }}>
          No activity for this period yet.
        </div>
      ) : (
        <>
          {/* Podium */}
          {showPodium && (
            <div style={podiumStyle}>
              {topThree.map(entry => (
                <div key={entry.profile_id} style={podiumCardStyle(entry.rank, entry.is_current_user)}>
                  <div style={{ fontSize: 22 }}>{RANK_MEDALS[entry.rank]}</div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: entry.is_current_user ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {entry.full_name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', marginTop: 2 }}>
                    {entry.total_points.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <AnimatedLeaderboard
            entries={rest}
            myRank={data?.my_rank ?? null}
            totalParticipants={data?.total_participants ?? 0}
            rankChange={rankChange}
            onRankChangeAnimated={clearRankChange}
          />
        </>
      )}
    </div>
  );
}
