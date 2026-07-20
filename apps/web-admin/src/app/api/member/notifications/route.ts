import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/member/notifications
 *
 * Returns paginated notification history (newest-first) plus the unread count.
 *
 * Query params:
 *   member_id  (required, UUID)
 *   cursor     (optional, created_at ISO string — exclusive upper bound)
 *   limit      (optional, int 1-50, default 20)
 *
 * Response:
 *   { notifications: NotificationItem[], unread_count: number, next_cursor: string | null }
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const member_id = sp.get('member_id') ?? '';
    const cursor    = sp.get('cursor');
    const limitRaw  = parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit     = Math.min(Math.max(isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw, 1), MAX_LIMIT);

    // Validate member_id UUID
    const uuidErr = validateUUIDs({ member_id });
    if (uuidErr) return uuidErr;

    // Auth
    const auth = await verifyMember(member_id, request);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    // Build list query
    let listQuery = admin
      .from('notifications')
      .select('id, notification_type, title, body, data, read_at, created_at')
      .eq('member_id', member_id)
      .order('created_at', { ascending: false });

    if (cursor) {
      listQuery = listQuery.lt('created_at', cursor);
    }

    listQuery = listQuery.limit(limit);

    // Unread count query (head-count — no row data)
    const unreadQuery = admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', member_id)
      .is('read_at', null);

    // Run both in parallel
    const [listResult, unreadResult] = await Promise.all([listQuery, unreadQuery]);

    if (listResult.error) {
      console.error('[notifications] list query error:', listResult.error.message);
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }

    const rows = listResult.data ?? [];
    const unread_count = unreadResult.count ?? 0;

    // next_cursor = created_at of last row when a full page was returned
    const next_cursor = rows.length === limit && rows.length > 0
      ? rows[rows.length - 1].created_at
      : null;

    return NextResponse.json({
      notifications: rows,
      unread_count,
      next_cursor,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
