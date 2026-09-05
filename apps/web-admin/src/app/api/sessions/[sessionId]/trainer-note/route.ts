import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import { sendNotification } from '@/lib/notifications/dispatcher';
import { checkFeatureAccess } from '@/lib/billing/featureGate';

const sessionNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;
    const uuidError = validateUUIDs({ sessionId });
    if (uuidError) return uuidError;

    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;
    const { admin, user_id, gym_id } = result;

    // Rate limit AFTER auth, keyed on the authenticated trainer (M-9).
    const rl = checkRateLimit(`trainer-note:${user_id}`, 10, 60_000);
    if (rl) return rl;

    // Tier gate: creating coach notes requires the coach_notes feature.
    const access = await checkFeatureAccess(gym_id, 'coach_notes');
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.upgradeMessage }, { status: 403 });
    }

    const parsed = sessionNoteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { note } = parsed.data;

    // Verify session belongs to this gym
    const { data: ws } = await admin
      .from('workout_sessions')
      .select('id, member_id, gym_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (!ws || ws.gym_id !== gym_id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: createdNote, error } = await admin
      .from('trainer_member_notes')
      .insert({
        trainer_id: user_id,
        member_id: ws.member_id,
        note_text: note,
        session_id: ws.id,
      })
      .select('id')
      .single();

    if (error || !createdNote) {
      return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
    }

    // Notify member via dispatcher — fire-and-forget, deep-links to /coach-notes/[id]
    sendNotification({
      gym_id,
      member_id: ws.member_id,
      type: 'coach_note',
      title: 'New coach note',
      body: 'Your trainer left you a note.',
      data: { note_id: createdNote.id },
    }).catch((err) => {
      console.error('[trainer-note] Notification dispatch failed:', err);
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
