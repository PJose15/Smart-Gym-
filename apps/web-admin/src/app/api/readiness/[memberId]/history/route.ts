import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const days = Math.min(
      Number(req.nextUrl.searchParams.get('days')) || 30,
      90
    );
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await admin
      .from('member_readiness_cache')
      .select('score_date, readiness_score, zone')
      .eq('member_id', params.memberId)
      .gte('score_date', since.toISOString().split('T')[0])
      .order('score_date', { ascending: false });

    if (error)
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    return NextResponse.json({ history: data ?? [], days });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
