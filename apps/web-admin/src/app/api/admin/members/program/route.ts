import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { uuidString, validateUUIDs } from '@/lib/validation/uuid';

/**
 * POST   /api/admin/members/program  — assign a program to a member
 * DELETE /api/admin/members/program?id=<assignmentId> — remove an assignment
 *
 * Staff-scoped to the caller's gym. member_program_assignments is service-role
 * only for writes, so all mutations go through the admin client. The table keys
 * on member_id (members.id) + program_id (programs.id); there is no profile_id
 * or gym_id column.
 */

const assignSchema = z.object({
  member_id: uuidString,
  program_id: uuidString,
});

export async function POST(request: NextRequest) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id, user_id } = result;

    const body = await request.json().catch(() => null);
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const { member_id, program_id } = parsed.data;

    // Validate member + program both belong to the caller's gym.
    const [memberRes, programRes] = await Promise.all([
      admin.from('members').select('id').eq('id', member_id).eq('gym_id', gym_id).maybeSingle(),
      admin.from('programs').select('id, name').eq('id', program_id).eq('gym_id', gym_id).maybeSingle(),
    ]);

    if (!memberRes.data) {
      return NextResponse.json({ error: 'Member is not part of your gym.' }, { status: 400 });
    }
    if (!programRes.data) {
      return NextResponse.json({ error: 'Program is not part of your gym.' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await admin
      .from('member_program_assignments')
      .insert({ member_id, program_id, assigned_by: user_id })
      .select('id, member_id, program_id')
      .single();

    if (insertError || !inserted) {
      console.error('[/api/admin/members/program] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to assign program' }, { status: 500 });
    }

    return NextResponse.json({
      assignment: {
        id: inserted.id,
        member_id: inserted.member_id,
        program_id: inserted.program_id,
        program_name: programRes.data.name,
      },
    });
  } catch (err) {
    console.error('[/api/admin/members/program] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ?? '';
    const invalid = validateUUIDs({ id });
    if (invalid) return invalid;

    // Confirm the assignment's member belongs to the caller's gym before delete.
    const { data: existing } = await admin
      .from('member_program_assignments')
      .select('id, member_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', existing.member_id)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { error: deleteError } = await admin
      .from('member_program_assignments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[/api/admin/members/program] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/members/program] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
