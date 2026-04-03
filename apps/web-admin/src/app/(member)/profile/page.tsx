'use client';

import { useEffect, useState } from 'react';
import { useMember } from '@/lib/contexts/MemberContext';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { SkeletonGate } from '@/components/skeleton';
import type { DNAResult } from '@nexera/types';
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

function ProfileSkeleton() {
  const bar = (w: string, h = 14) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        backgroundColor: 'var(--color-surface-secondary, #1e1e2e)',
      }}
    />
  );
  return (
    <div style={{ padding: 16, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
        {bar('120px', 18)}
        {bar('80px')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 12, backgroundColor: 'var(--color-surface-secondary, #1e1e2e)' }} />
        ))}
      </div>
      {bar('100%', 48)}
      {bar('100%', 48)}
    </div>
  );
}

function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K`;
  return String(lbs);
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
  backgroundColor: 'var(--color-surface, #141420)',
  borderRadius: 12,
  padding: 16,
  border: '1px solid var(--color-border, #2a2a3e)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 12px',
};

export default function ProfilePage() {
  const { member, loading: memberLoading } = useMember();
  const [dna, setDna] = useState<DNAResult | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [profileRes, dnaRes] = await Promise.all([
          fetch(`/api/member/${member.id}/profile`),
          fetch(`/api/member/${member.id}/dna`),
        ]);

        if (!profileRes.ok) throw new Error('Failed to load profile');
        const profileJson = await profileRes.json();
        setProfile(profileJson);

        if (dnaRes.ok) {
          const dnaJson = await dnaRes.json();
          if (dnaJson?.dna) setDna(dnaJson.dna);
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [member?.id, retryCount]);

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
    <SkeletonGate loading={loading} skeleton={<ProfileSkeleton />}>
      {profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, paddingTop: 24 }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <MemberAvatar
              src={member.avatar_url}
              name={member.display_name}
              size="xlarge"
              dna={dna ?? undefined}
            />
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 'var(--text-xl, 20px)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                {member.display_name}
              </h1>
              {dna?.archetype && !dna.is_building && (
                <p style={{ color: dna.archetype.color, fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
                  {dna.archetype.name}
                </p>
              )}
            </div>
          </div>

          {/* Level badge + XP bar */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: profile.level.current.color,
                }}
              />
              <span style={{ fontSize: 15, fontWeight: 700, color: profile.level.current.color }}>
                {profile.level.current.name}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Lv.{profile.level.current.level}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'var(--color-surface-secondary, #1e1e2e)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${profile.level.progressPct}%`,
                  borderRadius: 3,
                  backgroundColor: profile.level.current.color,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {profile.level.pointsToNext > 0
                ? `${profile.level.pointsToNext} pts to ${profile.level.next?.name ?? 'next level'}`
                : 'Max level reached'}
            </p>
          </div>

          {/* Lifetime stats grid */}
          <div>
            <p style={sectionTitle}>Lifetime Stats</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Workouts', value: String(profile.stats.total_workouts) },
                { label: 'Volume', value: `${formatVolume(profile.stats.total_volume_lbs)} lbs` },
                { label: 'Total Sets', value: String(profile.stats.total_sets) },
                { label: 'Time', value: formatDuration(profile.stats.total_duration_min) },
              ].map((stat) => (
                <div key={stat.label} style={cardStyle}>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Training consistency */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Avg / Week</p>
                <p style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 0', color: 'var(--color-text-primary)' }}>
                  {profile.stats.avg_workouts_per_week}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Goal</p>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0', color: 'var(--color-text-primary)' }}>
                  {formatGoal(profile.member.primary_goal)}
                </p>
              </div>
            </div>
          </div>

          {/* Streak card */}
          <div style={cardStyle}>
            <p style={sectionTitle}>Streak</p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-orange, #F97316)' }}>
                  {profile.streak.current}d
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>Current</p>
              </div>
              <div>
                <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  {profile.streak.best}d
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>Best</p>
              </div>
            </div>
          </div>

          {/* Favorite machines */}
          {profile.favorite_machines.length > 0 && (
            <div>
              <p style={sectionTitle}>Favorite Machines</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {profile.favorite_machines.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', width: 20 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {m.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {m.sessions} sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {profile.achievements.length > 0 && (
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
          )}

          {/* Member since */}
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', paddingBottom: 24 }}>
            Member since {new Date(profile.member.joined_gym_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}
    </SkeletonGate>
  );
}
