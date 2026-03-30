import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getMuscleMap } from '@/lib/muscleMap/muscleMapCache';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/**
 * GET /api/member/[memberId]/muscle-map
 * Returns the member's muscle recovery map.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;

    // Auth: verify the caller owns this member_id
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    // Fetch member's gym_id
    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const muscleMap = await getMuscleMap(memberId, member.gym_id, admin);

    return NextResponse.json({ muscleMap });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
