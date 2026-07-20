/**
 * Central notification dispatcher — the single gateway for all Phase 6 push sends.
 * NOTIF-01: ALL pushes must flow through this function.
 *
 * LOOP SAFETY: The is_agent_initiated flag only propagates forward in the data payload.
 * This file must remain free of any agent-triggering imports — enforced structurally
 * by the test suite (test 14b reads this source and asserts no forbidden references).
 *
 * Guard order (enforced exactly — tests assert call-counts at each step):
 *  1. Resolve identities (member→profile via members.user_id; profile→member via user_id+gym_id)
 *  2. Dedup 5-min (member: notifications table; owner-only: notification_log table)
 *  3. Inbox write (member-facing only — BEFORE push preference guards)
 *  4. Push guards (enabled, category, quiet hours, hourly rate cap)
 *  5. Deliver via Edge Function with 8s timeout
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NotificationType } from '@nexera/types';

// ── Public types ──────────────────────────────────────────────────────────────

export type SendResult = 'sent' | 'skipped' | 'no_devices' | 'error';

// ── Category column map ───────────────────────────────────────────────────────

type PushPrefColumn =
  | 'push_prs'
  | 'push_achievements'
  | 'push_level_up'
  | 'push_challenge_rank'
  | 'push_new_program'
  | 'push_trainer_note'
  | 'push_gym_feed';

/**
 * Maps notification types to their notification_preferences column.
 * Unmapped types are gated only by `enabled`, quiet hours, dedup, and rate cap.
 */
export const CATEGORY_COLUMN_MAP: Partial<Record<NotificationType, PushPrefColumn>> = {
  // push_prs
  pr_achieved: 'push_prs',
  // push_achievements
  badge_unlocked: 'push_achievements',
  streak_milestone: 'push_achievements',
  streak_broken: 'push_achievements',
  // push_level_up
  level_up: 'push_level_up',
  // push_challenge_rank
  challenge_rank_change: 'push_challenge_rank',
  challenge_complete: 'push_challenge_rank',
  leaderboard_rank: 'push_challenge_rank',
  // push_new_program
  program_assigned: 'push_new_program',
  // push_trainer_note
  coach_note: 'push_trainer_note',
  checkin_generated: 'push_trainer_note',
  checkin_reply: 'push_trainer_note',
  // push_gym_feed
  feed_reaction: 'push_gym_feed',
  feed_comment: 'push_gym_feed',
  new_follower: 'push_gym_feed',
  // Unmapped: agent_dormant_alert, agent_welcome, trial_ending, payment_failed,
  // subscription_cancelled, member_at_risk, weekly_summary, checkin_overdue,
  // machine_underutilized — gated only by enabled + quiet hours + dedup + rate cap
} as const;

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Determines if `nowTime` (UTC 'HH:MM:SS') falls within a quiet window.
 *
 * Same-day window (start <= end): nowTime >= start AND nowTime <= end
 * Overnight window (start > end):  nowTime >= start OR  nowTime <= end
 */
export function isInQuietWindow(nowTime: string, start: string, end: string): boolean {
  if (start <= end) {
    // Same-day window
    return nowTime >= start && nowTime <= end;
  } else {
    // Overnight window (e.g., 22:00 → 07:00 crosses midnight)
    return nowTime >= start || nowTime <= end;
  }
}

/**
 * Returns the current wall-clock time as 'HH:MM:SS' in the given IANA
 * timezone (notification_preferences.timezone, migration 032). Null, empty,
 * or invalid timezone falls back to UTC — the pre-timezone behavior.
 */
export function currentTimeInZone(
  timezone: string | null | undefined,
  now: Date = new Date()
): string {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(now);
      const get = (t: string) => parts.find(pt => pt.type === t)?.value ?? '00';
      return `${get('hour')}:${get('minute')}:${get('second')}`;
    } catch {
      // Invalid IANA name → fall back to UTC
    }
  }
  return now.toISOString().slice(11, 19);
}

// ── Admin client factory ──────────────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── resolveOwnerProfileId ─────────────────────────────────────────────────────

/**
 * Looks up the active owner's auth user ID (= profile_id) for a gym.
 * Queries: gym_memberships WHERE gym_id=$1 AND role='owner' AND status='active'
 */
export async function resolveOwnerProfileId(
  admin: SupabaseClient,
  gymId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('gym_memberships')
    .select('user_id')
    .eq('gym_id', gymId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return (data as { user_id: string }).user_id ?? null;
}

// ── sendNotification ──────────────────────────────────────────────────────────

/**
 * Single gateway for all notification sends.
 *
 * Call sites (06-05/06/07) MUST use this function — no direct Edge Function calls.
 *
 * @param input.member_id - members.id — for member-facing sends
 * @param input.profile_id - auth users.id — for owner-facing sends (no member row)
 * @param input.body - NEVER PII (no names, weights, health data, reply text — lock-screen exposure)
 */
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
  try {
    const admin = createAdminClient();
    const {
      gym_id,
      type,
      title,
      body,
      member_id: inputMemberId,
      profile_id: inputProfileId,
      data = {},
      is_agent_initiated = false,
    } = input;

    // ── Step 1: Resolve identities ────────────────────────────────────────────

    let resolvedProfileId: string | null = inputProfileId ?? null;
    let resolvedMemberId: string | null = inputMemberId ?? null;

    if (inputMemberId && !inputProfileId) {
      // member_id given → resolve profile_id via members.user_id
      const { data: memberRow } = await admin
        .from('members')
        .select('user_id')
        .eq('id', inputMemberId)
        .single();
      resolvedProfileId = (memberRow as { user_id: string | null } | null)?.user_id ?? null;
    } else if (!inputMemberId && inputProfileId) {
      // profile_id only → look up members.id via user_id + gym_id
      const { data: memberRow } = await admin
        .from('members')
        .select('id, user_id')
        .eq('user_id', inputProfileId)
        .eq('gym_id', gym_id)
        .maybeSingle();
      resolvedMemberId = (memberRow as { id: string } | null)?.id ?? null;
    }

    // ── Step 2: Dedup (5 min) ─────────────────────────────────────────────────

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    if (resolvedMemberId) {
      // Member-facing: check notifications table
      const { data: recentNotifs } = await admin
        .from('notifications')
        .select('id')
        .eq('member_id', resolvedMemberId)
        .eq('notification_type', type)
        .gt('created_at', fiveMinAgo)
        .limit(1);

      if (recentNotifs && recentNotifs.length > 0) {
        return 'skipped';
      }
    } else if (resolvedProfileId) {
      // Owner-only: check notification_log table
      const { data: recentLog } = await admin
        .from('notification_log')
        .select('id')
        .eq('profile_id', resolvedProfileId)
        .eq('type', type)
        .gt('created_at', fiveMinAgo)
        .limit(1);

      if (recentLog && recentLog.length > 0) {
        return 'skipped';
      }
    }

    // ── Step 3: Inbox write (member-facing only, BEFORE push guards) ──────────

    if (resolvedMemberId) {
      const { error: inboxError } = await admin.from('notifications').insert({
        member_id: resolvedMemberId,
        gym_id,
        notification_type: type,
        title,
        body,
        data: {
          ...data,
          is_agent_initiated: String(is_agent_initiated),
        },
        channel: 'push',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      if (inboxError) {
        console.error('[dispatcher] inbox insert failed:', inboxError.message);
      }
    }

    // ── Step 4: Push guards ───────────────────────────────────────────────────

    // Guard 4a: no profile_id → no device to push to
    if (!resolvedProfileId) {
      return 'no_devices';
    }

    // Guard 4b + 4c + 4d: fetch preferences (missing row = all defaults enabled).
    // Owner-only sends (resolvedMemberId null) have no preferences row — skip
    // the query entirely instead of matching .eq('member_id', '') which only
    // produces a silent Postgres error.
    let prefs: Record<string, unknown> | null = null;
    if (resolvedMemberId) {
      const { data: prefsRow } = await admin
        .from('notification_preferences')
        .select('*')
        .eq('member_id', resolvedMemberId)
        .maybeSingle();
      prefs = prefsRow as Record<string, unknown> | null;
    }

    if (prefs) {
      // Guard 4b: global enabled check
      if ((prefs as { enabled: boolean }).enabled === false) {
        return 'skipped';
      }

      // Guard 4c: category preference check
      const categoryCol = CATEGORY_COLUMN_MAP[type];
      if (categoryCol && (prefs as Record<string, unknown>)[categoryCol] === false) {
        return 'skipped';
      }

      // Guard 4d: quiet hours (unconditional — no urgency exception).
      // prefs.timezone (IANA, migration 032) localizes 'now'; null → UTC.
      if ((prefs as { quiet_hours_enabled: boolean }).quiet_hours_enabled) {
        const tz = (prefs as { timezone?: string | null }).timezone ?? null;
        const nowTime = currentTimeInZone(tz);
        const start = (prefs as { quiet_hours_start: string }).quiet_hours_start;
        const end = (prefs as { quiet_hours_end: string }).quiet_hours_end;
        if (isInQuietWindow(nowTime, start, end)) {
          return 'skipped';
        }
      }
    }
    // Missing prefs row: all defaults open (Open Question 2 resolution)

    // Guard 4e: hourly rate cap (max 10 pushes per profile per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: hourlyLog } = await admin
      .from('notification_log')
      .select('id')
      .eq('profile_id', resolvedProfileId)
      .gt('created_at', oneHourAgo)
      .limit(10);

    if (hourlyLog && hourlyLog.length >= 10) {
      return 'skipped';
    }

    // ── Step 5: Deliver via Edge Function ─────────────────────────────────────

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const edgeFnUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const response = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        profile_id: resolvedProfileId,
        type,
        title,
        body,
        data: {
          ...data,
          is_agent_initiated: String(is_agent_initiated),
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    const result = await response.json() as { sent?: number; message?: string };

    if (typeof result.sent === 'number' && result.sent > 0) {
      return 'sent';
    }
    return 'no_devices';
  } catch (err) {
    console.error('[dispatcher] sendNotification error:', err);
    return 'error';
  }
}
