import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const rl = checkRateLimit(`create-challenge:${params.gymId}`, 5, 60_000);
    if (rl) return rl;

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id, user_id } = result;
    if (gym_id !== params.gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { title, description, challenge_type, start_date, end_date, prize_description } = body;
    if (!title || !challenge_type || !start_date || !end_date) {
      return NextResponse.json({ error: 'title, challenge_type, start_date, end_date required' }, { status: 400 });
    }

    const validTypes = ['most-sessions', 'most-volume', 'most-machines', 'streak'];
    if (!validTypes.includes(challenge_type)) {
      return NextResponse.json({ error: `Invalid challenge_type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await admin.from('gym_challenges').insert({
      gym_id: params.gymId,
      created_by: user_id,
      title,
      description: description ?? null,
      challenge_type,
      start_date,
      end_date,
      prize_description: prize_description ?? null,
      is_active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
