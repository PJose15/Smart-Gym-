import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getReadinessScore } from '@/lib/readiness/readinessCache';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

/**
 * GET /api/member/[memberId]/readiness
 * Returns the member's current readiness score.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;

    // Auth: verify the caller owns this member_id
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin, member_id } = authResult;

    // Rate limit AFTER auth, keyed on the verified member (M-9):
    // 30 requests per minute per member
    const rl = checkRateLimit(`readiness:${member_id}`, 30, 60_000);
    if (rl) return rl;

    // Fetch member's gym_id
    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const readiness = await getReadinessScore(memberId, member.gym_id, admin);

    return NextResponse.json({ readiness });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
