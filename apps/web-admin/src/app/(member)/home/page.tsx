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

// Rotating daily training tip — mirrors mobile home's TRAINING_TIPS card
// (apps/mobile/app/(tabs)/index.tsx).
const TRAINING_TIPS = [
  'Warm up with 5 minutes of light cardio before lifting — it primes your muscles and reduces injury risk.',
  'Focus on controlled negatives: lowering the weight slowly builds more strength than rushing.',
  'Breathe out on the effort, in on the release. Proper breathing stabilises your core.',
  'Track your weights — even small weekly increases add up to big gains over months.',
  'Compound lifts (squat, deadlift, bench) give you the most bang for your time.',
  'Rest 60–90s between sets for hypertrophy, 2–3 min for strength work.',
  'Keep your phone in your bag during sets — distraction kills intensity.',
  'Good form at a lighter weight always beats bad form at a heavier weight.',
  'Eat protein within a couple of hours post-workout to support recovery.',
  'Consistency beats perfection — showing up 3× a week is better than one perfect session.',
  'Superset opposing muscles (e.g. biceps + triceps) to save time without losing quality.',
  'If a movement feels off, try a slight grip or stance adjustment before adding more weight.',
  "Progressive overload doesn't just mean more weight — more reps or slower tempo counts too.",
  'Deload weeks every 4–6 weeks let your joints and tendons catch up to your muscles.',
];

function getTodayTrainingTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return TRAINING_TIPS[dayOfYear % TRAINING_TIPS.length];
}

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
          {/* 1. HERO — greeting card (mobile HeroZone parity) */}
          <HeroZone
            hero={data.hero}
            level={data.level}
            avatarUrl={member?.avatar_url}
            muscleMap={data.muscleMap}
            name={member?.first_name || member?.display_name}
            streak={member?.current_streak || 0}
          />

          {/* 2. TODAY — what to do today */}
          <TodayZone
            program={data.program}
            todaySessions={data.today_sessions}
          />

          {/* 3. MOMENTUM — label + 3 stat tiles */}
          <MomentumZone
            streak={member?.current_streak || 0}
            weekSessions={data.stats.sessions_this_week}
            level={data.level}
            stats={data.stats}
          />

          {/* 4. Quick stats */}
          <QuickStatsRow stats={data.stats} />

          {/* Quick links — Readiness + Check-Ins (web-only, kept in the
              activity rhythm between stats and the community pulse) */}
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

          {data.challenge && <ChallengeZone challenge={data.challenge} />}

          {/* 5. COMMUNITY PULSE — activity */}
          <CommunityPulse feed={data.feed} />

          {/* Training tip — quiet L2 card (mobile trainingTipCard parity) */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl, 22px)',
            padding: 'var(--space-4, 16px)',
          }}>
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }} aria-hidden="true">💡</span>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              {getTodayTrainingTip()}
            </span>
          </div>
        </div>
      )}
    </SkeletonGate>
  );
}
