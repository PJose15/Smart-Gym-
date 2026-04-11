import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

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
    const body = await req.json();

    if (!body.note_text || typeof body.note_text !== 'string' || body.note_text.trim().length === 0) {
      return NextResponse.json({ error: 'note_text is required' }, { status: 400 });
    }

    const rl = checkRateLimit(`trainer-note-edit:${user_id}`, 30, 60_000);
    if (rl) return rl;

    const { data: note, error } = await admin
      .from('trainer_member_notes')
      .update({ note_text: body.note_text.trim() })
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
