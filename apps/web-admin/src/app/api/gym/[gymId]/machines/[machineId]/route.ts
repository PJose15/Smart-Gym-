import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

const machineUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(50),
    muscle_groups: z.array(z.string().trim().min(1).max(50)).max(20),
    instructions: z.string().trim().max(5000).nullable(),
    demo_video_url: z.string().url().max(500).nullable(),
    is_active: z.boolean(),
  })
  .partial();

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

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id, user_id } = result;

    if (gym_id !== gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Rate limit AFTER auth, keyed on the authenticated user (M-9).
    const rl = checkRateLimit(`update-machine:${user_id}`, 10, 60_000);
    if (rl) return rl;

    const parsed = machineUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { ...parsed.data };

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
