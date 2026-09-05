import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkFeatureAccess } from '@/lib/billing/featureGate';

const exerciseSchema = z.object({}).passthrough();
const daySchema = z
  .object({
    exercises: z.array(exerciseSchema).max(20).optional(),
  })
  .passthrough();

const programDataSchema = z
  .object({
    days: z.array(daySchema).max(14).optional(),
  })
  .passthrough();

const programPatchSchema = z.object({
  program_data: programDataSchema,
});

/**
 * PATCH /api/ai/programs/[programId] — trainer edits AI program
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const uuidError = validateUUIDs({ programId });
    if (uuidError) return uuidError;

    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;
    const { admin, user_id, gym_id } = result;

    // Tier gate: editing/approving AI programs requires ai_programs.
    const access = await checkFeatureAccess(gym_id, 'ai_programs');
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.upgradeMessage }, { status: 403 });
    }

    // Rate limit keyed on the authenticated staff user, not the caller-chosen
    // programId (M-9: never key limits on victim-controlled ids).
    const rl = checkRateLimit(`ai-program-edit:${user_id}`, 10, 60_000);
    if (rl) return rl;

    // Tenant binding (BE-H3): the program must belong to the caller's gym.
    // 404 for missing and cross-gym rows alike to avoid leaking existence.
    const { data: program } = await admin
      .from('ai_programs')
      .select('id')
      .eq('id', programId)
      .eq('gym_id', gym_id)
      .maybeSingle();
    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const body = await req.json();
    if (JSON.stringify(body).length > 50_000) {
      return NextResponse.json({ error: 'payload too large' }, { status: 413 });
    }
    const parsed = programPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { program_data } = parsed.data;

    const { error } = await admin
      .from('ai_programs')
      .update({
        program_data,
        trainer_modified: true,
        trainer_approved: true,
        trainer_approved_by: user_id,
        trainer_approved_at: new Date().toISOString(),
      })
      .eq('id', programId)
      .eq('gym_id', gym_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
