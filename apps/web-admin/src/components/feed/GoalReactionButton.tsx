'use client';

import { CSSProperties, useState } from 'react';

interface GoalReactionButtonProps {
  eventId: string;
  memberId: string;
  /** Only show on PR events */
  eventType: string;
  onReact?: (goalId: string) => void;
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(167, 139, 250, 0.3)',
  backgroundColor: 'rgba(167, 139, 250, 0.08)',
  color: '#A78BFA',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 0.4s ease, background-color 0.2s ease',
  fontFamily: 'inherit',
};

const activeStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'rgba(167, 139, 250, 0.2)',
  border: '1px solid rgba(167, 139, 250, 0.5)',
  cursor: 'default',
};

const scaleKeyframes = `
@keyframes goalBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes iconAppear {
  0% { opacity: 0; transform: scale(0.3); }
  100% { opacity: 1; transform: scale(1); }
}
`;

export function GoalReactionButton({ eventId, memberId, eventType, onReact }: GoalReactionButtonProps) {
  const [reacted, setReacted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Only show on PR events
  if (eventType !== 'pr_weight' && eventType !== 'pr_volume') {
    return null;
  }

  const handleClick = async () => {
    if (reacted || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/feed/${eventId}/goal-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });

      if (res.ok) {
        const data = await res.json();
        setReacted(true);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 500);
        onReact?.(data.goal_id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{scaleKeyframes}</style>
      <button
        onClick={handleClick}
        disabled={reacted || loading}
        style={{
          ...(reacted ? activeStyle : buttonStyle),
          animation: animating ? 'goalBounce 0.4s ease' : undefined,
        }}
      >
        <span style={{
          display: 'inline-block',
          animation: reacted && animating ? 'iconAppear 0.5s ease' : undefined,
        }}>
          {reacted ? '🎯' : '💪'}
        </span>
        {loading ? 'Setting goal...' : reacted ? 'Goal set!' : 'Working on this too'}
      </button>
    </>
  );
}
