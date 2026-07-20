import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/member/notifications/[notifId]/read
 *
 * Marks a notification as read. Idempotent — already-read notifications
 * still return { success: true }. Cross-member reads return 404.
 *
 * Body: { member_id: string (UUID) }
 *
 * Response: { success: true }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ notifId: string }> }
) {
  try {
    const { notifId } = await context.params;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const member_id = (body as Record<string, unknown>)?.member_id;
    if (typeof member_id !== 'string') {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }

    // Validate UUIDs
    const uuidErr = validateUUIDs({ notifId, member_id });
    if (uuidErr) return uuidErr;

    // Auth
    const auth = await verifyMember(member_id, request);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    // Rate limit: 60 mark-read ops per minute per member
    const rl = checkRateLimit(`notif-read:${member_id}`, 60, 60_000);
    if (rl) return rl;

    // Attempt to mark as read (only if not already read — member-scoped)
    const { data: updated } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId)
      .eq('member_id', member_id)
      .select('id')
      .single();

    if (!updated) {
      // Could be already-read or cross-member — distinguish with existence check
      const { data: exists } = await admin
        .from('notifications')
        .select('id')
        .eq('id', notifId)
        .eq('member_id', member_id)
        .maybeSingle();

      if (!exists) {
        // Not owned by this member (or doesn't exist) — 404
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }
      // Exists but already read — idempotent success
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
