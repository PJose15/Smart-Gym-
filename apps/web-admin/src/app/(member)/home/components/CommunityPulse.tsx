'use client';

import type { FeedEventData } from '@nexera/types';
import { CSSProperties } from 'react';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { formatFeedEventData } from '@/lib/feed/formatFeedEvent';

interface CommunityPulseProps {
  feed: FeedEventData[];
}

/**
 * CommunityPulse — mirrors apps/mobile/src/components/home/CommunityPulse.tsx:
 * uppercase ACTIVITY section label above one featured 22px L2 card with
 * hairline-separated rows and 38px icon circles.
 */

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 12,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-xl, 22px)',
  overflow: 'hidden',
};

const EVENT_ICONS: Record<string, string> = {
  achievement_earned: '🏅',
  level_up: '⭐',
  pr_weight: '🏆',
  pr_volume: '🏆',
  session_milestone: '💪',
  streak_milestone: '🔥',
  program_complete: '✅',
  challenge_launched: '🎯',
  new_member: '👋',
  gym_announcement: '📢',
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

export function CommunityPulse({ feed }: CommunityPulseProps) {
  const unit = useWeightUnit();
  if (feed.length === 0) return null;

  return (
    <div style={{ animation: 'slideUpFade 0.4s ease-out 0.35s both' }}>
      <div style={sectionLabelStyle}>Activity</div>

      <div style={cardStyle}>
        {feed.map((event, i) => (
          <div
            key={event.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: 'var(--space-4, 16px)',
              borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
            }}
          >
            {/* Icon circle — 38px, hairline border */}
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 18,
              lineHeight: 1,
            }}>
              {EVENT_ICONS[event.event_type] || '📢'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{event.member_name}</span>{' '}
                {formatFeedEventData(event, unit)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 11, color: 'var(--color-text-muted)' }}>
                <span>{timeAgo(event.created_at)}</span>
                {event.reaction_count > 0 && (
                  <span>{'👏'} {event.reaction_count}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
