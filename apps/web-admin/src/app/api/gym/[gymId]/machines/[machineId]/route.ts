import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

interface RouteParams {
  params: Promise<{ gymId: string; machineId: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { gymId, machineId } = await params;
    const uuidError = validateUUIDs({ gymId, machineId });
    if (uuidError) return uuidError;

    const rl = checkRateLimit(`update-machine:${machineId}`, 10, 60_000);
    if (rl) return rl;

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id } = result;

    if (gym_id !== gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const allowed = ['name', 'category', 'muscle_groups', 'instructions', 'demo_video_url', 'is_active'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    const { error } = await admin
      .from('machines')
      .update(updates)
      .eq('id', machineId)
      .eq('gym_id', gymId);

    if (error) return NextResponse.json({ error: 'Failed to update machine' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { gymId, machineId } = await params;
    const uuidError = validateUUIDs({ gymId, machineId });
    if (uuidError) return uuidError;

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id } = result;

    if (gym_id !== gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Check for existing sessions -- soft-delete if referenced
    const { count } = await admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('machine_id', machineId)
      .limit(1);

    if ((count ?? 0) > 0) {
      await admin
        .from('machines')
        .update({ is_active: false })
        .eq('id', machineId)
        .eq('gym_id', gymId);
    } else {
      await admin
        .from('machines')
        .delete()
        .eq('id', machineId)
        .eq('gym_id', gymId);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
