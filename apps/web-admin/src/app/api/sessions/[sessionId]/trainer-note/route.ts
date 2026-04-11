import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

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

    const rl = checkRateLimit(`trainer-note:${sessionId}`, 10, 60_000);
    if (rl) return rl;

    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;
    const { admin, user_id, gym_id } = result;

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

    const { error } = await admin
      .from('trainer_member_notes')
      .insert({
        trainer_id: user_id,
        member_id: ws.member_id,
        note_text: note,
        session_id: ws.id,
      });

    if (error) return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
