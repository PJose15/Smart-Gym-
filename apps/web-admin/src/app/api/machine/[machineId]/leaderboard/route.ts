import { NextResponse, NextRequest } from 'next/server';
import { getMachineLeaderboard } from '@/lib/social/machineLeaderboard';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym, assertInGym } from '@/lib/auth/tenant';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

/** GET /api/machine/[machineId]/leaderboard?gym_id=&member_id=&limit= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    const { machineId } = await params;
    const uuidError = validateUUIDs({ machineId });
    if (uuidError) return uuidError;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    const limit = Math.min(Number(searchParams.get('limit') ?? 10), 50);

    if (!searchParams.get('gym_id') || !memberId) {
      return NextResponse.json({ error: 'gym_id and member_id required' }, { status: 400 });
    }

    // Verify the authenticated user owns this member_id
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Tenant binding (BE-H4): gym derived from the member row — the
    // caller-supplied gym_id query param is ignored.
    const gymId = await resolveMemberGym(admin, memberId);
    if (!gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // The machine must belong to the member's gym (404 — don't leak existence)
    if (!(await assertInGym(admin, 'machines', machineId, gymId))) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
    }

    const entries = await getMachineLeaderboard(machineId, gymId, memberId, limit, admin);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[machine/leaderboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
