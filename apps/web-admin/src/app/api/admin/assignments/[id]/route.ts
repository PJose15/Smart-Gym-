import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

const patchSchema = z.object({
  status: z.enum(['active', 'paused']),
});

/**
 * PATCH /api/admin/assignments/[id] — toggle status (active/paused)
 * DELETE /api/admin/assignments/[id] — remove assignment
 * Both are staff-scoped to the caller's gym via the admin client.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  const { id } = await params;
  const invalid = validateUUIDs({ id });
  if (invalid) return invalid;

  try {
    const { admin, gym_id } = result;

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const { data: updated, error } = await admin
      .from('trainer_assignments')
      .update({ status: parsed.data.status })
      .eq('id', id)
      .eq('gym_id', gym_id)
      .select('id, gym_id, trainer_profile_id, member_profile_id, status, created_at')
      .maybeSingle();

    if (error) {
      console.error('[/api/admin/assignments/[id]] Update error:', error);
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ assignment: updated });
  } catch (err) {
    console.error('[/api/admin/assignments/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await admin
      .from('trainer_assignments')
      .delete()
      .eq('id', id)
      .eq('gym_id', gym_id);

    if (error) {
      console.error('[/api/admin/assignments/[id]] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/assignments/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
