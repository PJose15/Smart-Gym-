'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';

interface MemberProfile {
  full_name: string;
  email: string;
}

interface MemberStat {
  totalWorkouts: number;
  lastWorkout: string | null;
  currentProgram: string | null;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md)' as any,
  padding: 24,
  border: '1px solid var(--color-border-subtle)',
};

const statGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  marginBottom: 24,
};

const statValueStyle: CSSProperties = {
  fontSize: 'var(--text-2xl)' as any,
  fontWeight: 'var(--weight-bold)' as any,
  color: 'var(--color-text-primary)',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 'var(--text-sm)' as any,
  color: 'var(--color-text-muted)',
};

const linkBtnStyle: CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  fontSize: 'var(--text-base)' as any,
  fontWeight: 'var(--weight-medium)' as any,
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-blue)',
  borderRadius: 'var(--radius-sm)' as any,
  textDecoration: 'none',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 'var(--text-base)' as any,
  color: 'var(--color-blue-light)',
  textDecoration: 'none',
  fontWeight: 'var(--weight-medium)' as any,
};

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 'var(--radius-lg)' as any,
  fontSize: 12,
  fontWeight: 'var(--weight-medium)' as any,
  backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)',
};

export default function MemberDetailPage() {
  const params = useParams();
  const memberId = params.id as string;
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [stats, setStats] = useState<MemberStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMember();
  }, [memberId]);

  async function fetchMember() {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', memberId)
        .maybeSingle();

      setProfile(profileData);

      // Total completed workouts
      const { count } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', memberId)
        .eq('status', 'completed');

      // Last workout
      const { data: lastWk } = await supabase
        .from('workouts')
        .select('started_at')
        .eq('profile_id', memberId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Current program
      const { data: assignment } = await supabase
        .from('member_program_assignments')
        .select('programs:program_id(name)')
        .eq('profile_id', memberId)
        .limit(1)
        .maybeSingle();

      const programData = assignment?.programs as unknown as { name: string } | null;
      setStats({
        totalWorkouts: count ?? 0,
        lastWorkout: lastWk?.started_at ?? null,
        currentProgram: programData?.name ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load member data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Member" description="Loading..." />
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div className="spinner-enhanced" />
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <Link href="/members" style={backLinkStyle}>
          &larr; Back to Members
        </Link>

        <PageHeader
          title={profile?.full_name ?? 'Unknown Member'}
          description={profile?.email ?? ''}
        />

        {error && (
          <div style={{ backgroundColor: 'var(--color-red-subtle)', color: 'var(--color-red-light)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' as any, fontSize: 'var(--text-base)' as any, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Stats strip */}
        {stats && (
          <div style={statsStripStyle}>
            <span style={statsChipStyle}>{stats.totalWorkouts} workout{stats.totalWorkouts !== 1 ? 's' : ''}</span>
            <span style={{
              ...statsChipStyle,
              backgroundColor: stats.lastWorkout
                ? (Date.now() - new Date(stats.lastWorkout).getTime() < 7 * 86400000 ? 'var(--color-green-subtle)' : 'var(--color-gold-subtle)')
                : 'var(--color-red-subtle)',
              color: stats.lastWorkout
                ? (Date.now() - new Date(stats.lastWorkout).getTime() < 7 * 86400000 ? 'var(--color-green-light)' : 'var(--color-gold-light)')
                : 'var(--color-red-light)',
            }}>
              {stats.lastWorkout
                ? `Last active ${Math.floor((Date.now() - new Date(stats.lastWorkout).getTime()) / 86400000)}d ago`
                : 'Never active'}
            </span>
            <span style={{
              ...statsChipStyle,
              backgroundColor: stats.currentProgram ? 'var(--color-blue-subtle)' : 'var(--color-bg-elevated)',
              color: stats.currentProgram ? 'var(--color-blue-light)' : 'var(--color-text-muted)',
            }}>
              {stats.currentProgram ? `Program: ${stats.currentProgram}` : 'No program'}
            </span>
          </div>
        )}

        {stats && (
          <div style={statGridStyle}>
            <div style={cardStyle} className="section-glow">
              <div style={statValueStyle}>{stats.totalWorkouts}</div>
              <div style={statLabelStyle}>Total Workouts</div>
            </div>
            <div style={cardStyle} className="section-glow">
              <div style={statValueStyle}>
                {stats.lastWorkout
                  ? new Date(stats.lastWorkout).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '--'}
              </div>
              <div style={statLabelStyle}>Last Workout</div>
            </div>
            <div style={cardStyle} className="section-glow">
              <div style={{ ...statValueStyle, fontSize: 'var(--text-lg)' as any }}>
                {stats.currentProgram ?? 'None'}
              </div>
              <div style={statLabelStyle}>Current Program</div>
            </div>
          </div>
        )}

        <Link href={`/members/${memberId}/analytics`} style={linkBtnStyle}>
          View Analytics
        </Link>
      </div>
    </AnimatedPage>
  );
}
