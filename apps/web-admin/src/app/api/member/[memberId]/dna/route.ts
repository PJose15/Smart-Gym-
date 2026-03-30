import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { getDNAResult } from '@/lib/dna/dnaCache';

export const dynamic = 'force-dynamic';

/** GET /api/member/[memberId]/dna — Full DNA result with history */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const authResult = await verifyMember(memberId);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const result = await getDNAResult(memberId, member.gym_id, admin);
    return NextResponse.json({ dna: result });
  } catch (err) {
    console.error('[member/dna] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
