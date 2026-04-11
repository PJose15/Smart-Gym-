import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

const noteUpdateSchema = z.object({
  note_text: z.string().trim().min(1).max(2000),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { memberId: string; noteId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId, noteId: params.noteId });
    if (uuidError) return uuidError;
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const parsed = noteUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { note_text } = parsed.data;

    const rl = checkRateLimit(`trainer-note-edit:${user_id}`, 30, 60_000);
    if (rl) return rl;

    const { data: note, error } = await admin
      .from('trainer_member_notes')
      .update({ note_text })
      .eq('id', params.noteId)
      .eq('trainer_id', user_id)
      .eq('member_id', params.memberId)
      .eq('gym_id', gym_id)
      .select()
      .single();

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found or update failed' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    console.error('[trainer/notes PUT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { memberId: string; noteId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId, noteId: params.noteId });
    if (uuidError) return uuidError;
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    const rl = checkRateLimit(`trainer-note-edit:${user_id}`, 30, 60_000);
    if (rl) return rl;

    const { error } = await admin
      .from('trainer_member_notes')
      .delete()
      .eq('id', params.noteId)
      .eq('trainer_id', user_id)
      .eq('member_id', params.memberId)
      .eq('gym_id', gym_id);

    if (error) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trainer/notes DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
