'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMember } from '@/lib/contexts/MemberContext';
import { formatVolume } from '@/lib/weight';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { SkeletonGate } from '@/components/skeleton';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { DNAMiniPentagon } from '@/components/dna/DNAMiniPentagon';
import { MuscleMapScreen } from '@/components/muscleMap/MuscleMapScreen';
import { DNA_AXES } from '@nexera/ai-assist';
import type { DNAResult, MuscleMapResult } from '@nexera/types';
import type { LevelProgress } from '@nexera/ai-assist';

interface ProfileStats {
  total_workouts: number;
  total_volume_lbs: number;
  total_sets: number;
  total_duration_min: number;
  avg_workouts_per_week: number;
}

interface Achievement {
  code: string;
  title: string;
  description: string;
  category: string;
  icon_name: string | null;
  points: number;
  earned_at: string;
}

interface FavoriteMachine {
  id: string;
  name: string;
  sessions: number;
}

interface ProfileData {
  member: {
    id: string;
    display_name: string;
    first_name: string | null;
    avatar_url: string | null;
    primary_goal: string | null;
    experience_level: string | null;
    joined_gym_at: string;
  };
  level: LevelProgress;
  stats: ProfileStats;
  streak: { current: number; best: number };
  achievements: Achievement[];
  favorite_machines: FavoriteMachine[];
}

// Profile tabs — mirrors apps/mobile/src/components/profile/ProfileTabs.tsx
type ProfileTabKey = 'overview' | 'achievements' | 'dna' | 'bodymap';

const TABS: { key: ProfileTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'dna', label: 'DNA' },
  { key: 'bodymap', label: 'Body Map' },
];

function ProfileSkeleton() {
  const bar = (w: string, h = 14) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        backgroundColor: 'var(--color-bg-elevated)',
      }}
    />
  );
  return (
    <div style={{ padding: 16, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--color-bg-elevated)' }} />
        {bar('120px', 18)}
        {bar('80px')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 12, backgroundColor: 'var(--color-bg-elevated)' }} />
        ))}
      </div>
      {bar('100%', 48)}
      {bar('100%', 48)}
    </div>
  );
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min)}m`;
}

function formatGoal(goal: string | null): string {
  if (!goal) return 'General Fitness';
  return goal.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: 16,
  border: '1px solid var(--color-border-subtle)',
};

// Uppercase section kicker — mirrors mobile sectionTitle
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: '0 0 12px',
};

const monoValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  letterSpacing: '-0.02em',
};

export default function ProfilePage() {
  const { member, weightUnit, loading: memberLoading } = useMember();
  const [dna, setDna] = useState<DNAResult | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('overview');

  // Body map — lazily fetched when the tab is first opened
  const [muscleMap, setMuscleMap] = useState<MuscleMapResult | null>(null);
  const [muscleMapLoaded, setMuscleMapLoaded] = useState(false);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const [profileRes, dnaRes] = await Promise.all([
          fetch(`/api/member/${member.id}/profile`),
          fetch(`/api/member/${member.id}/dna`),
        ]);

        if (!profileRes.ok) throw new Error('Failed to load profile');
        const profileJson = await profileRes.json();
        if (!cancelled) setProfile(profileJson);

        if (dnaRes.ok) {
          const dnaJson = await dnaRes.json();
          if (dnaJson?.dna && !cancelled) setDna(dnaJson.dna);
        }
      } catch {
        if (!cancelled) setError('Something went wrong. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [member?.id, retryCount]);

  // Lazy-load recovery telemetry for the Body Map tab
  useEffect(() => {
    if (activeTab !== 'bodymap' || muscleMapLoaded || !member) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/member/${member.id}/muscle-map`);
        if (res.ok) {
          const json = await res.json();
          if (json?.muscleMap && !cancelled) setMuscleMap(json.muscleMap);
        }
      } catch {
        // Non-critical — tab shows its empty state
      } finally {
        if (!cancelled) setMuscleMapLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, muscleMapLoaded, member?.id]);

  if (memberLoading) {
    return <ProfileSkeleton />;
  }

  if (!member) {
    return (
      <div style={{ padding: 16, paddingTop: 24 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Not signed in.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
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
    );
  }

  return (
    <SkeletonGate loading={loading} skeleton={<ProfileSkeleton />}>
      {profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, paddingTop: 16 }}>
          {/* Top bar — serif NEXERA wordmark + settings gear
              (mirrors mobile ProfileHeader topRow) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 20,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
            }}>
              NEXERA
            </span>
            <Link
              href="/profile/settings"
              aria-label="Settings"
              style={{
                padding: 6,
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>

          {/* Identity hero card — 22px featured surface, corner crimson glow
              (mirrors mobile ProfileHeader card) */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl, 22px)',
            padding: 'var(--space-6, 24px)',
          }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -70,
                right: -70,
                width: 180,
                height: 180,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
                pointerEvents: 'none',
              }}
            />

            {/* Ring avatar with crimson halo glow */}
            <div style={{
              borderRadius: '50%',
              padding: 4,
              backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
              boxShadow: '0 0 18px var(--accent-glow, rgba(224, 20, 47, 0.28))',
              marginBottom: 12,
            }}>
              <MemberAvatar
                src={member.avatar_url}
                name={member.display_name}
                size="xlarge"
                dna={dna ?? undefined}
              />
            </div>

            {/* Serif name */}
            <h1 style={{
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-serif)',
              letterSpacing: '0.02em',
              textAlign: 'center',
            }}>
              {member.display_name}
            </h1>
            {dna?.archetype && !dna.is_building && (
              <p style={{ color: dna.archetype.color, fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
                {dna.archetype.name}
              </p>
            )}

            {/* LEVEL X · N XP — crimson mono line */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginTop: 10,
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: 'var(--accent-hover, #FF2740)',
              }}>
                LEVEL <span style={{ ...monoValue, fontSize: 13, fontWeight: 700 }}>{profile.level.current.level}</span>
              </span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>·</span>
              <span style={{ ...monoValue, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {(profile.level.score ?? 0).toLocaleString()} XP
              </span>
            </div>

            {/* Level name — tinted with the level color */}
            <span style={{ fontSize: 12, marginTop: 2, color: profile.level.current.color }}>
              {profile.level.current.name}
            </span>

            {/* Member since */}
            <span style={{ fontSize: 12, marginTop: 6, color: 'var(--color-text-muted)' }}>
              Member since {new Date(profile.member.joined_gym_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>

            {/* XP progress bar with "N XP TO LEVEL X+1" labels */}
            <div style={{ width: '100%', marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--accent-hover, #FF2740)',
                }}>
                  {profile.level.next
                    ? `${profile.level.pointsToNext.toLocaleString()} XP TO LEVEL ${profile.level.next.level}`
                    : 'MAX LEVEL REACHED'}
                </span>
                {profile.level.next && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-secondary)',
                  }}>
                    LEVEL {profile.level.next.level}
                  </span>
                )}
              </div>
              <div style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                backgroundColor: 'var(--color-bg-elevated)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${profile.level.progressPct}%`,
                  borderRadius: 3,
                  backgroundColor: 'var(--accent, #E0142F)',
                  boxShadow: '0 0 8px var(--accent-glow, rgba(224, 20, 47, 0.28))',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            {/* Quick stats — streak / sessions / XP pair (hairline top border) */}
            <div style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-evenly',
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border-subtle)',
            }}>
              {profile.streak.current > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...monoValue, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {profile.streak.current}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    🔥 STREAK
                  </div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...monoValue, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {profile.stats.total_workouts}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  SESSIONS
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...monoValue, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {(profile.level.score ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  XP
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar — OVERVIEW / ACHIEVEMENTS / DNA / BODY MAP with crimson
              active underline (mirrors mobile ProfileTabs) */}
          <div
            role="tablist"
            aria-label="Profile sections"
            style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 0 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: active ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-secondary)',
                    borderBottom: active
                      ? '2px solid var(--accent, #E0142F)'
                      : '2px solid transparent',
                    marginBottom: -1,
                    boxShadow: active ? '0 6px 8px -6px var(--accent-glow, rgba(224, 20, 47, 0.28))' : 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── OVERVIEW ─────────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {/* Lifetime stats — 2x2 mono stat tiles (mobile OverviewTab grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Sessions', value: String(profile.stats.total_workouts) },
                  { label: 'Volume', value: formatVolume(profile.stats.total_volume_lbs, weightUnit) },
                  { label: 'Sets', value: String(profile.stats.total_sets) },
                  { label: 'Time in Gym', value: formatDuration(profile.stats.total_duration_min) },
                ].map((stat) => (
                  <div key={stat.label} style={cardStyle}>
                    <p style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-secondary)',
                      margin: '0 0 8px',
                    }}>
                      {stat.label}
                    </p>
                    <p style={{ ...monoValue, fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Training consistency */}
              <div style={cardStyle}>
                <p style={sectionTitle}>Training Consistency</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, flex: 1 }}>
                    <span style={{ ...monoValue, fontSize: 18, fontWeight: 700, color: 'var(--accent-hover, #FF2740)' }}>
                      {profile.stats.avg_workouts_per_week}
                    </span>
                    {'  workouts / week'}
                  </p>
                  <div style={{
                    width: 60,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'var(--color-bg-elevated)',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (profile.stats.avg_workouts_per_week / 5) * 100)}%`,
                      borderRadius: 3,
                      backgroundColor: 'var(--accent, #E0142F)',
                    }} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
                  {profile.stats.avg_workouts_per_week >= 4
                    ? 'Elite consistency — you rarely miss a week.'
                    : profile.stats.avg_workouts_per_week >= 3
                      ? 'Strong habit — keep this rhythm going.'
                      : profile.stats.avg_workouts_per_week >= 2
                        ? 'Solid foundation — an extra day would accelerate gains.'
                        : 'Building momentum — consistency is the #1 factor for results.'}
                </p>
              </div>

              {/* Most used machines — hairline-separated rows */}
              {profile.favorite_machines.length > 0 && (
                <div style={cardStyle}>
                  <p style={sectionTitle}>Most Used Machines</p>
                  {profile.favorite_machines.map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                      }}
                    >
                      <span style={{ ...monoValue, fontSize: 14, fontWeight: 700, color: 'var(--accent-hover, #FF2740)', width: 30, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0 }}>
                        {m.name}
                      </span>
                      <span style={{ ...monoValue, fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                        {m.sessions}x
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Current focus (goal) */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }} aria-hidden="true">🎯</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ ...sectionTitle, color: 'var(--accent-hover, #FF2740)', margin: '0 0 4px' }}>Current Focus</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                      {formatGoal(profile.member.primary_goal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Coaching links — web-only extras, kept at the end of Overview */}
              <div>
                <p style={sectionTitle}>Coaching</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { href: '/check-ins', label: 'Weekly Check-Ins', sub: 'Reviews from your coach', dot: 'var(--gold, #E8B339)' },
                    { href: '/readiness', label: 'Readiness', sub: 'Today’s training readiness', dot: 'var(--readiness-peak, #00C896)' },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none' }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: l.dot, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{l.label}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{l.sub}</span>
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>&rsaquo;</span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── ACHIEVEMENTS ─────────────────────────────── */}
          {activeTab === 'achievements' && (
            <>
              {/* Streak card */}
              <div style={cardStyle}>
                <p style={sectionTitle}>Streak</p>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StreakFlame streakDays={profile.streak.current} size={22} />
                      <p style={{ ...monoValue, fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-streak, #FF6B35)' }}>
                        {profile.streak.current}d
                      </p>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>Current</p>
                  </div>
                  <div>
                    <p style={{ ...monoValue, fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {profile.streak.best}d
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>Best</p>
                  </div>
                </div>
              </div>

              {/* Badges grid */}
              {profile.achievements.length > 0 ? (
                <div>
                  <p style={sectionTitle}>
                    Badges · {profile.achievements.length} Unlocked
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {profile.achievements.slice(0, 9).map((a) => (
                      <div key={a.code} style={{ ...cardStyle, textAlign: 'center', padding: 12 }}>
                        <p style={{ fontSize: 22, margin: 0 }}>{a.icon_name ?? '🏅'}</p>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            margin: '6px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
                  <p style={{ fontSize: 32, margin: 0 }} aria-hidden="true">🏅</p>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
                    Keep training to unlock badges.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── DNA ──────────────────────────────────────── */}
          {activeTab === 'dna' && (
            dna && !dna.is_building && dna.archetype ? (
              <>
                {/* Radar hero card — archetype header + pentagon */}
                <div style={{
                  ...cardStyle,
                  borderRadius: 'var(--radius-xl, 22px)',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'center',
                }}>
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: -70,
                      right: -70,
                      width: 180,
                      height: 180,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-subtle, rgba(224, 20, 47, 0.10))',
                      pointerEvents: 'none',
                    }}
                  />
                  <p style={{ ...sectionTitle, color: 'var(--accent-hover, #FF2740)', margin: '0 0 6px' }}>Archetype</p>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: dna.archetype.color }}>
                    {dna.archetype.icon} {dna.archetype.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    {dna.archetype.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                    <DNAMiniPentagon
                      scores={dna.scores}
                      archetypeColor={dna.archetype.color}
                      size={220}
                      animated
                    />
                  </div>
                </div>

                {/* Dimensional breakdown — mono scores + thin bars */}
                <div style={cardStyle}>
                  <p style={sectionTitle}>Dimensional Breakdown</p>
                  {(() => {
                    const topKey = DNA_AXES.reduce(
                      (best, axis) => ((dna.scores[axis.key] ?? 0) > (dna.scores[best] ?? 0) ? axis.key : best),
                      DNA_AXES[0].key as (typeof DNA_AXES)[number]['key'],
                    );
                    return DNA_AXES.map((axis, i) => {
                      const score = dna.scores[axis.key] ?? 0;
                      const isTop = axis.key === topKey;
                      return (
                        <div
                          key={axis.key}
                          style={{
                            padding: '10px 0',
                            borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {axis.icon}  {axis.label}
                            </span>
                            <span style={{
                              ...monoValue,
                              fontSize: 20,
                              fontWeight: 700,
                              color: isTop ? 'var(--accent-hover, #FF2740)' : 'var(--color-text-primary)',
                            }}>
                              {score}
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${score}%`,
                              borderRadius: 2,
                              backgroundColor: isTop ? 'var(--accent, #E0142F)' : 'var(--color-text-muted)',
                              boxShadow: isTop ? '0 0 6px var(--accent-glow, rgba(224, 20, 47, 0.28))' : 'none',
                            }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ) : dna?.is_building ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ fontSize: 40, margin: 0 }} aria-hidden="true">🧬</p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--color-text-primary)', margin: '12px 0 0' }}>
                  Building Your DNA
                </p>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {dna.sessions_logged}/10 sessions completed. Keep training to unlock your full profile.
                </p>
                <div style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'var(--color-bg-elevated)',
                  overflow: 'hidden',
                  marginTop: 16,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((dna.sessions_logged / 10) * 100))}%`,
                    borderRadius: 3,
                    backgroundColor: 'var(--accent, #E0142F)',
                  }} />
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ fontSize: 40, margin: 0 }} aria-hidden="true">🧬</p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--color-text-primary)', margin: '12px 0 0' }}>
                  Performance DNA
                </p>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  Complete at least 10 sessions to unlock your Performance DNA profile.
                </p>
              </div>
            )
          )}

          {/* ── BODY MAP ─────────────────────────────────── */}
          {activeTab === 'bodymap' && (
            !muscleMapLoaded ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Loading recovery telemetry…
                </p>
              </div>
            ) : muscleMap ? (
              <div style={{ ...cardStyle, borderRadius: 'var(--radius-xl, 22px)' }}>
                <MuscleMapScreen data={muscleMap} />
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ fontSize: 40, margin: 0 }} aria-hidden="true">🏋️</p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--color-text-primary)', margin: '12px 0 0' }}>
                  Recovery Telemetry
                </p>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  Complete some workouts to see your muscle recovery status.
                </p>
              </div>
            )
          )}

          <div style={{ height: 8 }} />
        </div>
      )}
    </SkeletonGate>
  );
}
