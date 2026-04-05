import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getActiveGoals } from '@/lib/social/memberGoals';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

/** GET /api/member/[memberId]/goals/machine/[machineId] — Goals for specific machine */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string; machineId: string }> }
) {
  try {
    const { memberId, machineId } = await params;
    const uuidError = validateUUIDs({ memberId, machineId });
    if (uuidError) return uuidError;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const goals = await getActiveGoals(memberId, machineId, admin);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error('[member/goals/machine] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
