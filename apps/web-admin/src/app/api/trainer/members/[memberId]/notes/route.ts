import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { trainerNoteSchema } from '@/lib/validation/staff';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const { memberId } = params;

    const { data: notes } = await admin
      .from('trainer_member_notes')
      .select('*')
      .eq('trainer_id', user_id)
      .eq('member_id', memberId)
      .eq('gym_id', gym_id)
      .order('created_at', { ascending: false });

    return NextResponse.json(notes ?? []);
  } catch (err) {
    console.error('[trainer/notes GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;
    const body = await req.json();

    const parsed = trainerNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { note_type, note_text, session_id, is_visible_to_member } = parsed.data;

    const { data: note, error } = await admin
      .from('trainer_member_notes')
      .insert({
        trainer_id: user_id,
        member_id: params.memberId,
        gym_id,
        note_type,
        note_text,
        session_id: session_id ?? null,
        is_visible_to_member: is_visible_to_member ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('[trainer/notes POST] DB error:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('[trainer/notes POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
