import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getActiveGoals } from '@/lib/social/memberGoals';

export const dynamic = 'force-dynamic';

/** GET /api/member/[memberId]/goals — Get all active goals */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const goals = await getActiveGoals(memberId, null, admin);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error('[member/goals] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
