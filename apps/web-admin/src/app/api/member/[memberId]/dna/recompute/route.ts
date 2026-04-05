import { NextResponse, NextRequest } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { invalidateAndRefreshDNA } from '@/lib/dna/dnaCache';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

/** POST /api/member/[memberId]/dna/recompute — Force full DNA recompute */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;
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

    await invalidateAndRefreshDNA(memberId, member.gym_id, admin);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[member/dna/recompute] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
