'use client';

import { memo, useEffect, useRef, useState, CSSProperties } from 'react';
import { useAtRiskMembers } from '@/hooks/useAtRiskMembers';
import type { AtRiskMember, AtRiskReason } from '@nexera/ai-assist';

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const emptyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--color-green)',
  fontSize: 13,
  padding: '12px 0',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-base)',
  borderRadius: 8,
  borderLeft: '3px solid var(--color-red)',
};

const nameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

const reasonStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  marginTop: 2,
};

function formatReason(reason: AtRiskReason): string {
  switch (reason.type) {
    case 'no_workouts_7d':
      return reason.daysSinceLastWorkout === Infinity
        ? 'Never trained'
        : `No workout in ${reason.daysSinceLastWorkout} days`;
    case 'repeated_discomfort':
      return `${reason.count} discomfort reports (${reason.bodyAreas.join(', ')})`;
    case 'plateauing':
      return `Plateauing on ${reason.exerciseName} (${reason.weeksSameWeight}w)`;
    default:
      return 'At risk';
  }
}

const AtRiskMemberRow = memo(function AtRiskMemberRow({ member }: { member: AtRiskMember }) {
  return (
    <div style={rowStyle}>
      <div>
        <div style={nameStyle}>{member.memberName}</div>
        <div style={reasonStyle}>{formatReason(member.reasons[0])}</div>
      </div>
      {member.reasons.length > 1 && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          +{member.reasons.length - 1} more
        </span>
      )}
    </div>
  );
});

export function AtRiskList() {
  const { members, loading } = useAtRiskMembers();
  const [displayed, setDisplayed] = useState<AtRiskMember[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const prevMembersRef = useRef<AtRiskMember[]>([]);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Animate exits when members leave the list
  useEffect(() => {
    const prevIds = new Set(prevMembersRef.current.map((m) => m.profileId));
    const currentIds = new Set(members.map((m) => m.profileId));

    // Find removed members
    const removed = new Set<string>();
    prevIds.forEach((id) => {
      if (!currentIds.has(id)) removed.add(id);
    });

    // Clear any pending exit animation timer
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    if (removed.size > 0) {
      setExitingIds(removed);
      // Remove after animation completes
      exitTimerRef.current = setTimeout(() => {
        setExitingIds(new Set());
        setDisplayed(members);
      }, 600);
    } else {
      setExitingIds(new Set());
      setDisplayed(members);
    }

    prevMembersRef.current = members;

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [members]);

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading at-risk members...</div>;
  }

  if (displayed.length === 0) {
    return (
      <div style={emptyStyle}>
        <span style={{ fontSize: 16 }} aria-hidden="true">&#10003;</span>
        <span>All active members trained in the last 14 days.</span>
      </div>
    );
  }

  return (
    <div style={listStyle} role="list" aria-label="At-risk members">
      {displayed.map((member) => (
        <div
          key={member.profileId}
          className={exitingIds.has(member.profileId) ? 'at-risk-row-exit' : 'at-risk-row-enter'}
          role="listitem"
        >
          <AtRiskMemberRow member={member} />
        </div>
      ))}
    </div>
  );
}
