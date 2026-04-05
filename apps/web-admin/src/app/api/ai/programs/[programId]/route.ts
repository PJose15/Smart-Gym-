import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

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
    const { admin, user_id } = result;

    const rl = checkRateLimit(`ai-program-edit:${programId}`, 10, 60_000);
    if (rl) return rl;

    const body = await req.json();
    const { program_data } = body;

    if (!program_data) {
      return NextResponse.json({ error: 'program_data required' }, { status: 400 });
    }

    const { error } = await admin
      .from('ai_programs')
      .update({
        program_data,
        trainer_modified: true,
        trainer_approved: true,
        trainer_approved_by: user_id,
        trainer_approved_at: new Date().toISOString(),
      })
      .eq('id', programId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
