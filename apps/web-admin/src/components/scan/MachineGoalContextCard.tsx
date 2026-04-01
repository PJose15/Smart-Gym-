'use client';

import { CSSProperties, useEffect, useState } from 'react';
import type { MemberGoal } from '@nexera/types';
import { GoalProgressMiniBar } from './GoalProgressMiniBar';

interface MachineGoalContextCardProps {
  memberId: string;
  machineId: string;
  /** Current best weight on this machine in lbs */
  currentBestLbs: number;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 14,
  border: '1px solid rgba(167, 139, 250, 0.15)',
};

const GOAL_LABELS: Record<string, string> = {
  beat_pr: 'Beat PR',
  reach_weight: 'Reach Weight',
  hit_sessions: 'Session Goal',
  custom: 'Custom Goal',
};

export function MachineGoalContextCard({ memberId, machineId, currentBestLbs }: MachineGoalContextCardProps) {
  const [goals, setGoals] = useState<MemberGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `/api/member/${memberId}/goals/machine/${machineId}`
        );
        if (res.ok) {
          const data = await res.json();
          setGoals(data.goals ?? []);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [memberId, machineId]);

  if (loading || goals.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 14 }}>🎯</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Your Goal{goals.length > 1 ? 's' : ''}
        </span>
      </div>

      {goals.map((goal, i) => (
        <div key={goal.id} style={{ marginTop: i > 0 ? 10 : 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 600 }}>
              {GOAL_LABELS[goal.goal_type] ?? goal.goal_type}
            </span>
            {goal.target_weight_lbs && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Target: {goal.target_weight_lbs} lbs
              </span>
            )}
          </div>

          {goal.custom_description && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              {goal.custom_description}
            </div>
          )}

          {goal.target_weight_lbs && (
            <GoalProgressMiniBar
              current={currentBestLbs}
              target={goal.target_weight_lbs}
              unit="lbs"
            />
          )}

          {goal.inspired_by_member_id && (
            <div style={{
              fontSize: 11,
              color: '#A78BFA',
              marginTop: 4,
              fontStyle: 'italic',
            }}>
              Inspired by a gym member
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
