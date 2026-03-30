'use client';

import { useEffect, useRef, useState } from 'react';
import type { CheckInRecord } from '@nexera/types';
import { NexeraCoachAvatar } from './NexeraCoachAvatar';
import { StatPill } from './StatPill';

// ── Unread ritual timing (ms) ──────────────────
const MARK_READ_DELAY = 3000;
const PILL_FADE_START = 5000;
const PILL_FADE_DURATION = 500;

interface CheckInMessageProps {
  checkIn: CheckInRecord;
  trainerName?: string | null;
  trainerAvatarUrl?: string | null;
  gymName?: string;
  isUnread?: boolean;
  onMarkRead?: () => void;
}

export function CheckInMessage({
  checkIn,
  trainerName,
  trainerAvatarUrl,
  gymName,
  isUnread,
  onMarkRead,
}: CheckInMessageProps) {
  const sentDate = checkIn.sent_at ? formatRelativeTime(checkIn.sent_at) : '';

  // ── Unread ritual state ──────────────────────────
  const [isFirstView, setIsFirstView] = useState(!!isUnread);
  const [showNewPill, setShowNewPill] = useState(!!isUnread);
  const [pillFading, setPillFading] = useState(false);
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent clears isUnread externally
  useEffect(() => {
    if (!isUnread) {
      setIsFirstView(false);
      setShowNewPill(false);
      setPillFading(false);
    }
  }, [isUnread]);

  // Auto-mark-read after 3s
  useEffect(() => {
    if (!isFirstView) return;
    markReadTimer.current = setTimeout(() => {
      onMarkRead?.();
      setIsFirstView(false);
    }, MARK_READ_DELAY);
    return () => { if (markReadTimer.current) clearTimeout(markReadTimer.current); };
  }, [isFirstView, onMarkRead]);

  // NEW pill fade: start fading at 5s, hide at 5.5s
  useEffect(() => {
    if (!showNewPill) return;
    pillFadeTimer.current = setTimeout(() => setPillFading(true), PILL_FADE_START);
    pillHideTimer.current = setTimeout(() => setShowNewPill(false), PILL_FADE_START + PILL_FADE_DURATION);
    return () => {
      if (pillFadeTimer.current) clearTimeout(pillFadeTimer.current);
      if (pillHideTimer.current) clearTimeout(pillHideTimer.current);
    };
  }, [showNewPill]);

  return (
    <div className={`check-in-card space-y-4${isFirstView ? ' unread' : ''}`}>
      {/* Sender identity */}
      <div className="flex items-center gap-3">
        {checkIn.trainer_id && trainerName ? (
          <>
            {trainerAvatarUrl ? (
              <img
                src={trainerAvatarUrl}
                alt={trainerName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-300 text-lg font-bold text-white">
                {trainerName[0]}
              </div>
            )}
            <div className="flex-1">
              <span className="block font-semibold text-zinc-900">
                {trainerName}
              </span>
              <span className="text-sm text-zinc-500">
                Your trainer{gymName ? ` · ${gymName}` : ''}
              </span>
            </div>
          </>
        ) : (
          <>
            <NexeraCoachAvatar size="large" />
            <div className="flex-1">
              <span className="block font-semibold text-zinc-900">
                Your Nexera Coach
              </span>
              <span className="text-sm text-zinc-500">
                AI Coach{gymName ? ` · ${gymName}` : ''}
              </span>
            </div>
          </>
        )}
        {showNewPill && (
          <span className={`new-pill${pillFading ? ' new-pill--fading' : ''}`}>NEW</span>
        )}
        <span className="text-xs text-zinc-400">{sentDate}</span>
      </div>

      {/* Message body */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <p className="whitespace-pre-line text-zinc-800 leading-relaxed">
          {checkIn.final_message}
        </p>
      </div>

      {/* Week stats */}
      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Your week in numbers
        </span>
        <div className="flex gap-2">
          <StatPill
            value={checkIn.sessions_this_week}
            label="sessions"
          />
          <StatPill
            value={`${checkIn.total_volume_lbs.toLocaleString()} lbs`}
            label="volume"
          />
          <StatPill
            value={checkIn.prs_this_week}
            label="PRs"
            highlight={checkIn.prs_this_week > 0}
          />
          <StatPill
            value={`${checkIn.current_streak}d`}
            label="streak"
          />
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const d = new Date(isoStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
