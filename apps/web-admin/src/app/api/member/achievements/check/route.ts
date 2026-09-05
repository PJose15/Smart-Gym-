import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uuidString } from '@/lib/validation/uuid';
import { checkAchievementsForMember } from '@/lib/achievements';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { checkRateLimit } from '@/lib/rateLimit';

const schema = z.object({
  member_id: uuidString,
  // Accepted for backward compatibility but IGNORED — the gym is derived
  // from the verified member row (Stage 5 tenant binding).
  gym_id: uuidString.optional(),
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

    const { member_id } = parsed.data;

    const authResult = await verifyMember(member_id);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`achievement-check:${member_id}`, 30, 60_000);
    if (rl) return rl;

    // Tenant binding: gym comes from the member row, never the body
    const gymId = await resolveMemberGym(admin, member_id);
    if (!gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await checkAchievementsForMember(admin, member_id, gymId);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
