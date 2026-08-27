import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { uuidString, validateUUIDs } from '@/lib/validation/uuid';

/**
 * Program roster management, staff-scoped to the caller's gym.
 *
 * GET    /api/admin/programs/[id]/members
 *   → { assigned: [...], unassigned: [...] }
 * POST   /api/admin/programs/[id]/members  { member_id }
 *   → assign a member (members.id) to the program
 * DELETE /api/admin/programs/[id]/members?assignmentId=<id>
 *   → remove an assignment
 *
 * member_program_assignments keys on member_id (members.id) + program_id.
 * Names come from the linked `users` account (display_name/email). The
 * `gym_members` view cannot embed profiles, so joins run server-side with the
 * service-role admin client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadProgram(admin: any, programId: string, gymId: string) {
  const { data } = await admin
    .from('programs')
    .select('id, gym_id')
    .eq('id', programId)
    .eq('gym_id', gymId)
    .maybeSingle();
  return data as { id: string; gym_id: string } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const invalid = validateUUIDs({ id });
  if (invalid) return invalid;

  try {
    const { admin, gym_id } = result;

    const program = await loadProgram(admin, id, gym_id);
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const [membersRes, assignRes] = await Promise.all([
      admin
        .from('members')
        .select('id, user_id, display_name, email')
        .eq('gym_id', gym_id)
        .order('display_name'),
      admin
        .from('member_program_assignments')
        .select('id, member_id')
        .eq('program_id', id),
    ]);

    const memberRows: { id: string; user_id: string | null; display_name: string; email: string | null }[] =
      membersRes.data ?? [];

    // Resolve display names from the linked user account when present.
    const userIds = Array.from(
      new Set(memberRows.map((m) => m.user_id).filter((uid): uid is string => !!uid)),
    );
    const usersById: Record<string, { display_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);
      for (const u of users ?? []) usersById[u.id] = { display_name: u.display_name, email: u.email };
    }

    const nameOf = (m: { user_id: string | null; display_name: string; email: string | null }) => {
      const account = m.user_id ? usersById[m.user_id] : undefined;
      return account?.display_name ?? m.display_name ?? 'Unknown';
    };
    const emailOf = (m: { user_id: string | null; email: string | null }) => {
      const account = m.user_id ? usersById[m.user_id] : undefined;
      return account?.email ?? m.email ?? null;
    };

    const assignedByMember: Record<string, string> = {};
    for (const a of assignRes.data ?? []) assignedByMember[a.member_id] = a.id;

    const assigned = memberRows
      .filter((m) => assignedByMember[m.id])
      .map((m) => ({
        assignment_id: assignedByMember[m.id],
        member_id: m.id,
        name: nameOf(m),
        email: emailOf(m),
      }));

    const unassigned = memberRows
      .filter((m) => !assignedByMember[m.id])
      .map((m) => ({
        member_id: m.id,
        name: nameOf(m),
        email: emailOf(m),
      }));

    return NextResponse.json({ assigned, unassigned });
  } catch (err) {
    console.error('[/api/admin/programs/[id]/members] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const assignSchema = z.object({ member_id: uuidString });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const invalid = validateUUIDs({ id });
  if (invalid) return invalid;

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

    const program = await loadProgram(admin, id, gym_id);
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const { data: member } = await admin
      .from('members')
      .select('id, user_id, display_name, email')
      .eq('id', parsed.data.member_id)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Member is not part of your gym.' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await admin
      .from('member_program_assignments')
      .insert({ member_id: member.id, program_id: id, assigned_by: user_id })
      .select('id, member_id')
      .single();

    if (insertError || !inserted) {
      console.error('[/api/admin/programs/[id]/members] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to assign member' }, { status: 500 });
    }

    let name = member.display_name ?? 'Unknown';
    let email = member.email ?? null;
    if (member.user_id) {
      const { data: user } = await admin
        .from('users')
        .select('display_name, email')
        .eq('id', member.user_id)
        .maybeSingle();
      if (user) {
        name = user.display_name ?? name;
        email = user.email ?? email;
      }
    }

    return NextResponse.json({
      assignment: { assignment_id: inserted.id, member_id: inserted.member_id, name, email },
    });
  } catch (err) {
    console.error('[/api/admin/programs/[id]/members] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('assignmentId') ?? '';
  const invalid = validateUUIDs({ id, assignmentId });
  if (invalid) return invalid;

  try {
    const { admin, gym_id } = result;

    const program = await loadProgram(admin, id, gym_id);
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    // Ensure the assignment belongs to this program before deleting.
    const { data: existing } = await admin
      .from('member_program_assignments')
      .select('id')
      .eq('id', assignmentId)
      .eq('program_id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { error: deleteError } = await admin
      .from('member_program_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      console.error('[/api/admin/programs/[id]/members] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/programs/[id]/members] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
