import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const url = req.nextUrl.searchParams;
    const limit = Math.min(Number(url.get('limit')) || 30, 100);
    const offset = Number(url.get('offset')) || 0;

    const { data, error } = await admin
      .from('body_metrics')
      .select('*')
      .eq('member_id', params.memberId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    return NextResponse.json({ metrics: data ?? [], limit, offset });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const rl = checkRateLimit(`body-metrics:${params.memberId}`, 10, 60_000);
    if (rl) return rl;

    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const body = await req.json();
    const { weight_lbs, weight_kg, body_fat_percentage, notes } = body;

    if (!weight_lbs && !weight_kg) {
      return NextResponse.json({ error: 'weight_lbs or weight_kg required' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('body_metrics')
      .insert({
        member_id: params.memberId,
        weight_lbs: weight_lbs ?? null,
        weight_kg: weight_kg ?? null,
        body_fat_percentage: body_fat_percentage ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to log metrics' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
