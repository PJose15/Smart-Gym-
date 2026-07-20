/**
 * Notification inbox service — fetch paginated inbox from the 06-08 API
 * and mark individual notifications as read.
 *
 * Conventions (mirrors challengeService.ts):
 *  - API calls use EXPO_PUBLIC_API_URL + Bearer JWT from Supabase session
 *  - getMemberId() resolves the members.id FK from the auth user_id
 *  - All functions return null/false on any error — never throw
 *
 * Deep-link navigation for tapped inbox rows: import resolveNotificationRoute
 * from ./notificationService (map is already built there, see plan 06-01).
 */
import { supabase } from './supabase';
import { getMemberId } from './memberData';
import type { NotificationType } from '@nexera/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InboxNotification {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

export interface InboxResult {
  notifications: InboxNotification[];
  unread_count: number;
  next_cursor: string | null;
}

// ─── fetchInbox ───────────────────────────────────────────────────────────────

/**
 * Fetch paginated notification inbox for the authenticated member.
 *
 * Returns null on any error (network, auth, non-OK response) — graceful,
 * matching fetchChallengeDetail convention.
 *
 * @param cursor  ISO timestamp for cursor-based pagination (from next_cursor)
 */
export async function fetchInbox(cursor?: string): Promise<InboxResult | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return null;

    const memberId = await getMemberId(session.user.id);
    if (!memberId) return null;

    const apiBase = process.env.EXPO_PUBLIC_API_URL;
    if (!apiBase) {
      if (__DEV__) {
        console.warn(
          '[notificationInboxService] EXPO_PUBLIC_API_URL is not set — inbox is unavailable. ' +
            'Add it to your .env / EAS build profile.',
        );
      }
      return null;
    }

    const params = new URLSearchParams({ member_id: memberId });
    if (cursor) params.set('cursor', cursor);

    const url = `${apiBase}/api/member/notifications?${params.toString()}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as InboxResult;
    return json;
  } catch {
    return null;
  }
}

// ─── markRead ────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read (idempotent — server returns 200 on
 * already-read rows, 404 on cross-member).
 *
 * Returns true on success, false on any error. Never throws.
 */
export async function markRead(notificationId: string): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return false;

    const memberId = await getMemberId(session.user.id);
    if (!memberId) return false;

    const apiBase = process.env.EXPO_PUBLIC_API_URL;
    if (!apiBase) {
      if (__DEV__) {
        console.warn(
          '[notificationInboxService] EXPO_PUBLIC_API_URL is not set — mark-read is unavailable. ' +
            'Add it to your .env / EAS build profile.',
        );
      }
      return false;
    }

    const res = await fetch(
      `${apiBase}/api/member/notifications/${notificationId}/read`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ member_id: memberId }),
      },
    );

    return res.ok;
  } catch {
    return false;
  }
}
