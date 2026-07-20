/**
 * Session-complete push coalescer — NOTIF-02
 *
 * Barrage prevention: one completed workout produces AT MOST ONE push even when it
 * triggers PR + badge + level-up + streak simultaneously.
 *
 * Priority order (highest wins):
 *   level_up > badge_unlocked > pr_achieved > streak_milestone > streak_broken > null
 *
 * PII rule: NO names, weights, or exercise names in title or body (lock-screen exposure).
 */

import { sendNotification } from '@/lib/notifications/dispatcher';
import type { NotificationType } from '@nexera/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STREAK_MILESTONES = new Set([7, 14, 30, 50, 100]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionPushInput {
  leveledUp: boolean;
  badgesUnlocked: number;
  isPersonalBest: boolean;
  streak: number;
  previousStreak: number;
}

export interface SessionPushEvent {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendSessionCompletePushInput extends SessionPushInput {
  gym_id: string;
  member_id: string;
}

// ── Pure coalescer ────────────────────────────────────────────────────────────

/**
 * Pure function — no I/O.
 * Returns exactly one push event (highest priority) or null when nothing notable happened.
 */
export function pickSessionPushEvent(input: SessionPushInput): SessionPushEvent | null {
  const { leveledUp, badgesUnlocked, isPersonalBest, streak, previousStreak } = input;

  // Priority 1: level_up
  if (leveledUp) {
    return {
      type: 'level_up',
      title: 'You reached a new level',
      body: 'Keep it up — big session today. Check your new level.',
    };
  }

  // Priority 2: badge_unlocked
  if (badgesUnlocked > 0) {
    return {
      type: 'badge_unlocked',
      title: 'Badge unlocked',
      body: 'You earned a new badge — see your profile for details.',
    };
  }

  // Priority 3: pr_achieved
  // When PR coalesces with other events (streak milestone), body acknowledges combo generically
  if (isPersonalBest) {
    const hasOtherEvents = STREAK_MILESTONES.has(streak);
    return {
      type: 'pr_achieved',
      title: 'New personal record',
      body: hasOtherEvents
        ? 'Big session — PR and more. See your progress.'
        : 'New personal record — see your progress.',
    };
  }

  // Priority 4: streak_milestone
  if (STREAK_MILESTONES.has(streak)) {
    return {
      type: 'streak_milestone',
      title: 'Streak milestone hit',
      body: `You've hit a ${streak}-day workout streak. Stay consistent!`,
    };
  }

  // Priority 5: streak_broken (real streak reset)
  if (previousStreak > 1 && streak === 1) {
    return {
      type: 'streak_broken',
      title: 'Streak reset',
      body: 'Your workout streak reset — time to build it back up.',
    };
  }

  // Nothing notable
  return null;
}

// ── Dispatcher wrapper ────────────────────────────────────────────────────────

/**
 * Coalesces session events into at most one push and dispatches fire-and-forget.
 * Never throws — rejections are caught and logged.
 */
export async function sendSessionCompletePush(input: SendSessionCompletePushInput): Promise<void> {
  const { gym_id, member_id, ...sessionInput } = input;

  const event = pickSessionPushEvent(sessionInput);
  if (!event) return;

  sendNotification({
    gym_id,
    member_id,
    type: event.type,
    title: event.title,
    body: event.body,
    ...(event.data ? { data: event.data } : {}),
  }).catch(err =>
    console.error('[sessionPush] push dispatch failed:', err instanceof Error ? err.message : 'Unknown error')
  );
}
