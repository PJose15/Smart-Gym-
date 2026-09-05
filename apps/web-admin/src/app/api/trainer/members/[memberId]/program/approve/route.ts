import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

/**
 * POST /api/trainer/members/[memberId]/program/approve
 * Trainer approves an AI-generated program for the member.
 * Body: { program_id: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;

    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id } = result;

    // Rate limit AFTER auth, keyed on the authenticated trainer (M-9).
    const rl = checkRateLimit(`trainer-approve:${user_id}`, 10, 60_000);
    if (rl) return rl;
    const { memberId } = params;

    const body = await request.json();
    const { program_id } = body;

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    // Verify member belongs to this gym
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify program belongs to this member
    const { data: program } = await admin
      .from('ai_programs')
      .select('id, member_id')
      .eq('id', program_id)
      .eq('member_id', memberId)
      .maybeSingle();

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Approve
    const { error: updateError } = await admin
      .from('ai_programs')
      .update({
        trainer_approved: true,
        trainer_approved_at: new Date().toISOString(),
        trainer_approved_by: user_id,
      })
      .eq('id', program_id);

    if (updateError) {
      console.error('[trainer/program/approve] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to approve program' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[trainer/program/approve] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
