'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useMember } from '@/lib/contexts/MemberContext';
import { SkeletonGate } from '@/components/skeleton';
import { HeroZone } from './components/HeroZone';
import { TodayZone } from './components/TodayZone';
import { MomentumZone } from './components/MomentumZone';
import { ChallengeZone } from './components/ChallengeZone';
import { CommunityPulse } from './components/CommunityPulse';
import { QuickStatsRow } from './components/QuickStatsRow';
import { HomeScreenSkeleton } from './components/HomeScreenSkeleton';
import type { HomeScreenData } from '@nexera/types';

export default function HomePage() {
  const { member, gym } = useMember();
  const [data, setData] = useState<HomeScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!member || !gym) return;

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/member/home?member_id=${member.id}&gym_id=${gym.id}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [member, gym, retryCount]);

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          style={{
            backgroundColor: 'var(--color-blue)',
            color: '#fff',
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
    );
  }

  return (
    <SkeletonGate loading={loading} skeleton={<HomeScreenSkeleton />}>
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
          <HeroZone
            hero={data.hero}
            level={data.level}
            avatarUrl={member?.avatar_url}
            muscleMap={data.muscleMap}
          />

          {/* Quick links — Readiness + Check-Ins */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { href: '/readiness', label: 'Readiness', dot: 'var(--readiness-peak, #00C896)' },
              { href: '/check-ins', label: 'Check-Ins', dot: 'var(--gold, #E8B339)' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: l.dot }} />
                {l.label}
              </Link>
            ))}
          </div>

          <TodayZone
            program={data.program}
            todaySessions={data.today_sessions}
          />

          <MomentumZone
            streak={member?.current_streak || 0}
            weekSessions={data.stats.sessions_this_week}
            level={data.level}
            stats={data.stats}
          />

          <QuickStatsRow stats={data.stats} />

          {data.challenge && <ChallengeZone challenge={data.challenge} />}

          <CommunityPulse feed={data.feed} />
        </div>
      )}
    </SkeletonGate>
  );
}
