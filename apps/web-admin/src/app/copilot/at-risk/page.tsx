'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '../../components/PageHeader';
import { AnimatedPage } from '../../components/AnimatedPage';
import { computeAtRiskMembers } from '@nexera/ai-assist';
import type { MemberData, AtRiskMember } from '@nexera/ai-assist';

// ─── Styles ─────────────────────────────────────────────

const tableContainerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid var(--color-border-subtle)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  backgroundColor: 'var(--color-bg-elevated)',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 14,
  color: 'var(--color-text-primary)',
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
    type === 'no_workouts_7d' ? 'var(--color-gold-subtle)' :
    type === 'repeated_discomfort' ? 'var(--color-red-light)' :
    'var(--accent-subtle)',
  color:
    type === 'no_workouts_7d' ? 'var(--color-gold)' :
    type === 'repeated_discomfort' ? 'var(--color-red)' :
    'var(--color-purple)',
});

const emptyStateStyle: CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  color: 'var(--color-text-muted)',
  fontSize: 15,
};

const errorStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-light)',
  color: 'var(--color-red)',
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

const statsStripStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const statsChipStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: 'var(--color-bg-highest)',
  color: 'var(--color-text-muted)',
};

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

      const { data: assignments, error: assignErr } = await supabase
        .from('trainer_assignments')
        .select('member_profile_id')
        .eq('trainer_profile_id', user.id)
        .eq('status', 'active');

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const memberIds = assignments.map((a) => a.member_profile_id);

      // trainer_assignments.member_profile_id is a users.id; workout_sessions
      // keys on members.id — map through the members table.
      const { data: memberRows, error: memberErr } = await supabase
        .from('members')
        .select('id, user_id')
        .in('user_id', memberIds);

      if (memberErr) throw memberErr;

      const memberRowIds = (memberRows ?? []).map((m) => m.id);
      const userIdByMemberId = new Map<string, string | null>(
        (memberRows ?? []).map((m) => [m.id, m.user_id]),
      );

      // Fetch profiles, completed sessions, and discomfort in parallel
      const [profilesRes, sessionsRes, discomfortRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', memberIds),
        supabase.from('workout_sessions').select('member_id, completed_at, session_date').in('member_id', memberRowIds).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('feedback_discomfort_summary').select('profile_id, discomfort_count_7d, top_body_areas_7d').in('profile_id', memberIds),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      const profiles = profilesRes.data;
      const discomfortData = discomfortRes.data;

      // Most recent completed session per user id (rows are sorted desc)
      const lastCompletedByUser = new Map<string, string>();
      for (const s of sessionsRes.data ?? []) {
        const uid = userIdByMemberId.get(s.member_id);
        if (!uid || lastCompletedByUser.has(uid)) continue;
        lastCompletedByUser.set(uid, s.completed_at);
      }

      // Build MemberData array
      interface DiscomfortSummary {
        profile_id: string;
        discomfort_count_7d?: number;
        top_body_areas_7d?: string[];
      }

      const memberDataList: MemberData[] = memberIds.map((pid) => {
        const profile = profiles?.find((p) => p.id === pid);
        const discomfort = discomfortData?.find((d) => d.profile_id === pid) as DiscomfortSummary | undefined;

        return {
          profileId: pid,
          memberName: profile?.full_name ?? 'Unknown',
          lastWorkoutAt: lastCompletedByUser.get(pid) ?? null,
          discomfortCount7d: discomfort?.discomfort_count_7d ?? 0,
          discomfortBodyAreas: discomfort?.top_body_areas_7d ?? [],
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

        {/* Stats strip */}
        {members.length > 0 && (() => {
          const allReasons = members.flatMap((m) => m.reasons);
          const inactiveCount = allReasons.filter((r) => r.type === 'no_workouts_7d').length;
          const discomfortCount = allReasons.filter((r) => r.type === 'repeated_discomfort').length;
          const plateauCount = allReasons.filter((r) => r.type === 'plateauing').length;
          return (
            <div style={statsStripStyle}>
              <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>{members.length} at-risk member{members.length !== 1 ? 's' : ''}</span>
              {inactiveCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-gold-subtle)', color: 'var(--color-gold)' }}>{inactiveCount} inactive</span>}
              {discomfortCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--color-red-light)', color: 'var(--color-red)' }}>{discomfortCount} discomfort</span>}
              {plateauCount > 0 && <span style={{ ...statsChipStyle, backgroundColor: 'var(--accent-subtle)', color: 'var(--color-purple)' }}>{plateauCount} plateauing</span>}
              <span style={statsChipStyle}>{allReasons.length} total flag{allReasons.length !== 1 ? 's' : ''}</span>
            </div>
          );
        })()}

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
