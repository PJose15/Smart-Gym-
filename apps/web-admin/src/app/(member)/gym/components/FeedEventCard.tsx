'use client';

import { CSSProperties, useMemo, useState } from 'react';
import type { FeedEventFull, ReactionType } from '@nexera/types';
import { ReactionBar } from './ReactionBar';
import { CommentSection } from './CommentSection';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { reformatWeightInText } from '@/lib/weight';

interface FeedEventCardProps {
  event: FeedEventFull;
  memberId: string;
  onToggleReaction: (eventId: string, type: ReactionType) => void;
}

const EVENT_ICONS: Record<string, string> = {
  achievement_earned: '\uD83C\uDFC5',
  level_up: '\u2B50',
  pr_weight: '\uD83C\uDFC6',
  pr_volume: '\uD83C\uDFC6',
  session_milestone: '\uD83D\uDCAA',
  streak_milestone: '\uD83D\uDD25',
  program_complete: '\u2705',
  challenge_launched: '\uD83C\uDFAF',
  challenge_joined: '\uD83C\uDFAF',
  challenge_rank_1: '\uD83E\uDD47',
  challenge_podium: '\uD83C\uDFC5',
  challenge_complete: '\uD83C\uDFC1',
  new_member: '\uD83D\uDC4B',
  gym_announcement: '\uD83D\uDCE2',
  member_spotlight: '\u2728',
  goal_reached: '\uD83C\uDF1F',
  archetype_change: '\uD83E\uDDEC',
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 14,
  transition: 'transform 0.15s ease',
};

const pinnedStyle: CSSProperties = {
  ...cardStyle,
  border: '1px solid rgba(59, 130, 246, 0.3)',
};

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

export function FeedEventCard({ event, memberId, onToggleReaction }: FeedEventCardProps) {
  const [showComments, setShowComments] = useState(false);
  const icon = EVENT_ICONS[event.event_type] || '\uD83D\uDCE2';
  const unit = useWeightUnit();
  // Feed descriptions are server-baked with lbs embedded. Rewrite any "N lbs"
  // substrings at render time so kg viewers see their preferred unit.
  const description = useMemo(
    () => reformatWeightInText(event.description, unit),
    [event.description, unit]
  );

  return (
    <div style={event.is_pinned ? pinnedStyle : cardStyle}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Avatar or icon */}
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
            backgroundColor: 'var(--color-bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {event.is_pinned && (
            <div style={{ fontSize: 10, color: '#60A5FA', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pinned
            </div>
          )}
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{event.member_name}</span>{' '}
            {description}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>{timeAgo(event.created_at)}</span>
            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
              }}
            >
              {event.comment_count > 0 ? `${event.comment_count} comments` : 'Comment'}
            </button>
          </div>

          <ReactionBar
            reactions={event.reactions}
            myReactions={event.my_reactions}
            onToggle={(type) => onToggleReaction(event.id, type)}
          />
        </div>
      </div>

      {showComments && (
        <CommentSection eventId={event.id} memberId={memberId} />
      )}
    </div>
  );
}
