import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const rl = checkRateLimit(`readiness-log:${params.memberId}`, 5, 60_000);
    if (rl) return rl;

    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const body = await req.json();
    const { sleep, soreness, mood, stress, energy } = body;

    // Validate 1-10 range
    const inputs: Record<string, unknown> = {
      sleep,
      soreness,
      mood,
      stress,
      energy,
    };
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val !== 'number' || val < 1 || val > 10) {
        return NextResponse.json(
          { error: `${key} must be 1-10` },
          { status: 400 }
        );
      }
    }

    // Calculate readiness score (0-100)
    // Weights: sleep 30%, soreness (inverted) 20%, mood 15%, stress (inverted) 20%, energy 15%
    const score = Math.round(
      sleep * 3 +
        (11 - soreness) * 2 +
        mood * 1.5 +
        (11 - stress) * 2 +
        energy * 1.5
    );
    const zone = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';

    // Upsert today's readiness
    const today = new Date().toISOString().split('T')[0];
    const { error } = await admin.from('member_readiness_cache').upsert(
      {
        member_id: params.memberId,
        score_date: today,
        readiness_score: score,
        zone,
        sleep_score: sleep,
        soreness_score: soreness,
        mood_score: mood,
        stress_score: stress,
        energy_score: energy,
      },
      { onConflict: 'member_id,score_date' }
    );

    if (error)
      return NextResponse.json(
        { error: 'Failed to log readiness' },
        { status: 500 }
      );
    return NextResponse.json({ score, zone, date: today });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
