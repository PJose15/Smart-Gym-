'use client';

import { CSSProperties } from 'react';
import type { FeedEventFull, ReactionType } from '@nexera/types';
import { ReactionBar } from '@/app/(member)/gym/components/ReactionBar';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { formatWeight } from '@/lib/weight';

interface GoalReachedCardProps {
  event: FeedEventFull;
  onToggleReaction: (eventId: string, type: ReactionType) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 14,
  border: '1px solid rgba(251, 191, 36, 0.2)',
  transition: 'transform 0.15s ease',
};

export function GoalReachedCard({ event, onToggleReaction }: GoalReachedCardProps) {
  const unit = useWeightUnit();
  const ctx = event.context_data as {
    goal_id?: string;
    machine_name?: string;
    target_weight?: number;
    achieved_weight?: number;
    inspired_by_member_id?: string;
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Goal icon */}
        {event.avatar_url ? (
          <img
            src={event.avatar_url}
            alt=""
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(251, 191, 36, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}>
            🎯
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            color: '#FBBF24',
            fontWeight: 600,
            marginBottom: 2,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Goal Reached
          </div>

          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{event.member_name}</span>{' '}
            {event.description}
          </div>

          {/* Weight detail */}
          {ctx.achieved_weight && ctx.target_weight && (
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 8,
            }}>
              <div style={{
                fontSize: 12,
                color: '#FBBF24',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderRadius: 6,
                padding: '3px 8px',
              }}>
                🎯 {formatWeight(ctx.achieved_weight, unit)} (target:{' '}
                {formatWeight(ctx.target_weight, unit, { showUnit: false })})
              </div>
              {ctx.machine_name && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'rgba(148, 163, 184, 0.1)',
                  borderRadius: 6,
                  padding: '3px 8px',
                }}>
                  {ctx.machine_name}
                </div>
              )}
            </div>
          )}

          {ctx.inspired_by_member_id && (
            <div style={{
              fontSize: 12,
              color: '#A78BFA',
              marginTop: 6,
              fontStyle: 'italic',
            }}>
              Inspired by another member&apos;s PR
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {timeAgo(event.created_at)}
          </div>

          <ReactionBar
            reactions={event.reactions}
            myReactions={event.my_reactions}
            onToggle={(type) => onToggleReaction(event.id, type)}
          />
        </div>
      </div>
    </div>
  );
}
