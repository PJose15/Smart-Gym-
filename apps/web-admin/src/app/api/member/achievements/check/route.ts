import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAchievementsForMember } from '@/lib/achievements';
import { verifyMember } from '@/lib/auth/verifyMember';

const schema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
});

/**
 * POST /api/member/achievements/check
 * Checks for new badge unlocks and level-ups for a member.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, gym_id } = parsed.data;

    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const result = await checkAchievementsForMember(admin, member_id, gym_id);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
