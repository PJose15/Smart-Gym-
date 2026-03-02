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
  backgroundColor: '#ffffff',
  borderRadius: 10,
  padding: 24,
  border: '1px solid rgba(0,0,0,0.06)',
};

const statGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  marginBottom: 24,
};

const statValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1a1a2e',
  marginBottom: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#999',
};

const linkBtnStyle: CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4361ee',
  borderRadius: 8,
  textDecoration: 'none',
};

const backLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginBottom: 16,
  fontSize: 14,
  color: '#4361ee',
  textDecoration: 'none',
  fontWeight: 600,
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
        .single();

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
          <div style={{ backgroundColor: '#fdecea', color: '#b71c1c', padding: '14px 18px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
            {error}
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
              <div style={{ ...statValueStyle, fontSize: 20 }}>
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
