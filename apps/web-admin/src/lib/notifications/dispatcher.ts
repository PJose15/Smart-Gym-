/**
 * Central notification dispatcher — the single gateway for all Phase 6 push sends.
 * NOTIF-01: ALL pushes must flow through this function.
 *
 * LOOP SAFETY: This file MUST NOT import or call triggerUptimizeAIAgent or anything
 * from lib/billing/triggerAgent. The is_agent_initiated flag only propagates forward
 * in the data payload.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationType } from '@nexera/types';

export type SendResult = 'sent' | 'skipped' | 'no_devices' | 'error';

type PushPrefColumn =
  | 'push_prs'
  | 'push_achievements'
  | 'push_level_up'
  | 'push_challenge_rank'
  | 'push_new_program'
  | 'push_trainer_note'
  | 'push_gym_feed';

export const CATEGORY_COLUMN_MAP: Partial<Record<NotificationType, PushPrefColumn>> = {
  pr_achieved: 'push_prs',
  badge_unlocked: 'push_achievements',
  streak_milestone: 'push_achievements',
  streak_broken: 'push_achievements',
  level_up: 'push_level_up',
  challenge_rank_change: 'push_challenge_rank',
  challenge_complete: 'push_challenge_rank',
  leaderboard_rank: 'push_challenge_rank',
  program_assigned: 'push_new_program',
  coach_note: 'push_trainer_note',
  checkin_generated: 'push_trainer_note',
  checkin_reply: 'push_trainer_note',
  feed_reaction: 'push_gym_feed',
  feed_comment: 'push_gym_feed',
  new_follower: 'push_gym_feed',
} as const;

export function isInQuietWindow(nowTime: string, start: string, end: string): boolean {
  throw new Error('not implemented');
}

export async function resolveOwnerProfileId(
  admin: SupabaseClient,
  gymId: string
): Promise<string | null> {
  throw new Error('not implemented');
}

export async function sendNotification(input: {
  gym_id: string;
  type: NotificationType;
  title: string;
  body: string;
  member_id?: string;
  profile_id?: string;
  data?: Record<string, string>;
  is_agent_initiated?: boolean;
}): Promise<SendResult> {
  throw new Error('not implemented');
}
