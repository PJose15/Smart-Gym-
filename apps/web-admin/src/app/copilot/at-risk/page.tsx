'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';
import { computeAtRiskMembers } from '@smartgym/ai-assist';
import type { MemberData, AtRiskMember } from '@smartgym/ai-assist';

// ─── Styles ─────────────────────────────────────────────

const tableContainerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid rgba(0,0,0,0.06)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #eee',
  fontWeight: 600,
  color: '#555',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: 14,
  color: '#333',
  verticalAlign: 'top',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  marginRight: 4,
  marginBottom: 4,
};

const reasonBadge = (type: string): CSSProperties => ({
  ...badgeStyle,
  backgroundColor:
    type === 'no_workouts_7d' ? '#fff3e0' :
    type === 'repeated_discomfort' ? '#fce4e6' :
    '#e8eaf6',
  color:
    type === 'no_workouts_7d' ? '#e65100' :
    type === 'repeated_discomfort' ? '#c62828' :
    '#283593',
});

const emptyStateStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  color: '#999',
  fontSize: 15,
};

const errorStyle: CSSProperties = {
  backgroundColor: '#fdecea',
  color: '#b71c1c',
  padding: '14px 18px',
  borderRadius: 8,
  fontSize: 14,
  marginBottom: 16,
};

// ─── Helpers ────────────────────────────────────────────

function reasonLabel(reason: AtRiskMember['reasons'][0]): string {
  switch (reason.type) {
    case 'no_workouts_7d':
      return reason.daysSinceLastWorkout === Infinity
        ? 'Never worked out'
        : `Inactive ${reason.daysSinceLastWorkout}d`;
    case 'repeated_discomfort':
      return `Discomfort x${reason.count} (${reason.bodyAreas.join(', ')})`;
    case 'plateauing':
      return `Plateau: ${reason.exerciseName} (${reason.weeksSameWeight}wk)`;
  }
}

// ─── Component ──────────────────────────────────────────

export default function AtRiskPage() {
  const [members, setMembers] = useState<AtRiskMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAtRiskMembers();
  }, []);

  async function fetchAtRiskMembers() {
    try {
      // Fetch members assigned to current trainer
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: assignments } = await supabase
        .from('trainer_assignments')
        .select('member_profile_id')
        .eq('trainer_profile_id', user.id)
        .eq('status', 'active');

      if (!assignments || assignments.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const memberIds = assignments.map((a) => a.member_profile_id);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberIds);

      // Fetch last workout per member
      const { data: workouts } = await supabase
        .from('workouts')
        .select('profile_id, finished_at')
        .in('profile_id', memberIds)
        .eq('status', 'completed')
        .order('finished_at', { ascending: false });

      // Fetch discomfort data
      const { data: discomfortData } = await supabase
        .from('feedback_discomfort_summary')
        .select('*')
        .in('profile_id', memberIds);

      // Build MemberData array
      const memberDataList: MemberData[] = memberIds.map((pid) => {
        const profile = profiles?.find((p) => p.id === pid);
        const lastWorkout = workouts?.find((w) => w.profile_id === pid);
        const discomfort = discomfortData?.find((d) => d.profile_id === pid);

        return {
          profileId: pid,
          memberName: profile?.full_name ?? 'Unknown',
          lastWorkoutAt: lastWorkout?.finished_at ?? null,
          discomfortCount7d: (discomfort as any)?.discomfort_count_7d ?? 0,
          discomfortBodyAreas: (discomfort as any)?.top_body_areas_7d ?? [],
          plateauExercises: [], // Plateau detection requires additional query logic
        };
      });

      const atRisk = computeAtRiskMembers(memberDataList);
      setMembers(atRisk);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load at-risk members');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AnimatedPage>
        <div style={{ padding: 24 }}>
          <PageHeader title="At-Risk Members" description="Members who may need trainer attention" />
          <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner-enhanced" /></div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ padding: 24 }}>
        <PageHeader
          title="At-Risk Members"
          description="Members flagged for inactivity, repeated discomfort, or plateauing"
        />

        {error && <div style={errorStyle}>{error}</div>}

        {members.length === 0 ? (
          <div style={tableContainerStyle}>
            <div className="empty-breathe" style={emptyStateStyle}>
              No at-risk members detected. All your members are on track.
            </div>
          </div>
        ) : (
          <div style={tableContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Risk Reasons</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, i) => (
                  <tr
                    key={member.profileId}
                    className={`row-stagger stagger-${Math.min(i, 19)} table-row-hover`}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{member.memberName}</span>
                    </td>
                    <td style={tdStyle}>
                      {member.reasons.map((reason, j) => (
                        <span key={j} style={reasonBadge(reason.type)}>
                          {reasonLabel(reason)}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
