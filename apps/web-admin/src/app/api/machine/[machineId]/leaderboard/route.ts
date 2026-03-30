import { NextResponse, NextRequest } from 'next/server';
import { getMachineLeaderboard } from '@/lib/social/machineLeaderboard';
import { verifyMember } from '@/lib/auth/verifyMember';

export const dynamic = 'force-dynamic';

/** GET /api/machine/[machineId]/leaderboard?gym_id=&member_id=&limit= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    const { machineId } = await params;
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get('gym_id');
    const memberId = searchParams.get('member_id');
    const limit = Math.min(Number(searchParams.get('limit') ?? 10), 50);

    if (!gymId || !memberId) {
      return NextResponse.json({ error: 'gym_id and member_id required' }, { status: 400 });
    }

    // Verify the authenticated user owns this member_id
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const entries = await getMachineLeaderboard(machineId, gymId, memberId, limit, admin);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[machine/leaderboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
