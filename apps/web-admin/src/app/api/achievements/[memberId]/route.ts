import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId, req);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const { data, error } = await admin
      .from('member_achievements')
      .select('*, achievement_definitions(*)')
      .eq('member_id', params.memberId)
      .order('earned_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
    return NextResponse.json({ achievements: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
