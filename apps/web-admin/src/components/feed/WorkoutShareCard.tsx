'use client';

import { CSSProperties } from 'react';
import type { FeedEventFull, ReactionType, WorkoutShareContext } from '@nexera/types';
import { ReactionBar } from '@/app/(member)/gym/components/ReactionBar';

interface WorkoutShareCardProps {
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
  backgroundColor: '#1E293B',
  borderRadius: 12,
  padding: 14,
  transition: 'transform 0.15s ease',
};

const pulseKeyframes = `
@keyframes greenPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

export function WorkoutShareCard({ event, onToggleReaction }: WorkoutShareCardProps) {
  const ctx = (event.context_data ?? {}) as unknown as WorkoutShareContext;
  const isTraining = ctx.share_status === 'training';

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* Avatar or training icon */}
          {event.avatar_url ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={event.avatar_url}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
              {isTraining && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  border: '2px solid #1E293B',
                  animation: 'greenPulse 2s infinite',
                }} />
              )}
            </div>
          ) : (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: isTraining ? 'rgba(34, 197, 94, 0.15)' : '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}>
              {isTraining ? '🏋️' : '✅'}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Status label */}
            {isTraining && (
              <div style={{
                fontSize: 10,
                color: '#22C55E',
                fontWeight: 600,
                marginBottom: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Live
              </div>
            )}

            {/* Member name + description */}
            <div style={{ fontSize: 14, color: '#E2E8F0', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{event.member_name}</span>{' '}
              {event.description}
            </div>

            {/* Program context */}
            {ctx.program_focus && (
              <div style={{
                fontSize: 12,
                color: '#94A3B8',
                marginTop: 4,
              }}>
                {ctx.program_week && ctx.program_day
                  ? `Week ${ctx.program_week}, Day ${ctx.program_day} — ${ctx.program_focus}`
                  : ctx.program_focus}
              </div>
            )}

            {/* Completed results */}
            {!isTraining && (ctx.volume_lbs > 0 || ctx.prs_hit > 0 || ctx.machines_used.length > 0) && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 8,
              }}>
                {ctx.volume_lbs > 0 && (
                  <div style={{
                    fontSize: 12,
                    color: '#E2E8F0',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: 6,
                    padding: '3px 8px',
                  }}>
                    💪 {ctx.volume_lbs.toLocaleString()} lbs
                  </div>
                )}
                {ctx.prs_hit > 0 && (
                  <div style={{
                    fontSize: 12,
                    color: '#FBBF24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderRadius: 6,
                    padding: '3px 8px',
                  }}>
                    🏆 {ctx.prs_hit} PR{ctx.prs_hit > 1 ? 's' : ''}
                  </div>
                )}
                {ctx.machines_used.length > 0 && (
                  <div style={{
                    fontSize: 12,
                    color: '#94A3B8',
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    borderRadius: 6,
                    padding: '3px 8px',
                  }}>
                    {ctx.machines_used.length} machine{ctx.machines_used.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Time + reactions */}
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
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
    </>
  );
}
