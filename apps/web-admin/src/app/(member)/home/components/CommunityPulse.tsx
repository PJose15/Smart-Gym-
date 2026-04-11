'use client';

import type { FeedEventData } from '@nexera/types';
import { CSSProperties } from 'react';
import { useWeightUnit } from '@/lib/contexts/MemberContext';
import { reformatWeightInText } from '@/lib/weight';

interface CommunityPulseProps {
  feed: FeedEventData[];
}

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-md, 12px)',
  padding: 'var(--space-4, 16px)',
  animation: 'slideUpFade 0.4s ease-out 0.35s both',
};

const EVENT_ICONS: Record<string, string> = {
  achievement_earned: '\uD83C\uDFC5',
  level_up: '\u2B50',
  pr_weight: '\uD83C\uDFC6',
  pr_volume: '\uD83C\uDFC6',
  session_milestone: '\uD83D\uDCAA',
  streak_milestone: '\uD83D\uDD25',
  program_complete: '\u2705',
  challenge_launched: '\uD83C\uDFAF',
  new_member: '\uD83D\uDC4B',
  gym_announcement: '\uD83D\uDCE2',
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
    <div style={cardStyle}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}>
        Gym Activity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feed.map((event) => (
          <div key={event.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
              {EVENT_ICONS[event.event_type] || '\uD83D\uDCE2'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                <span style={{ fontWeight: 600 }}>{event.member_name}</span>{' '}
                {reformatWeightInText(event.description, unit)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 11, color: 'var(--color-text-muted)' }}>
                <span>{timeAgo(event.created_at)}</span>
                {event.reaction_count > 0 && (
                  <span>\uD83D\uDC4F {event.reaction_count}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
