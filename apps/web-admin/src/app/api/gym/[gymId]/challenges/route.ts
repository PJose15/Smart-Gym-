import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkFeatureAccess } from '@/lib/billing/featureGate';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createChallengeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  challenge_type: z.enum(['most-sessions', 'most-volume', 'most-machines', 'streak']),
  start_date: z.string().regex(ISO_DATE),
  end_date: z.string().regex(ISO_DATE),
  prize_description: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const uuidError = validateUUIDs({ gymId: params.gymId });
    if (uuidError) return uuidError;
    const rl = checkRateLimit(`create-challenge:${params.gymId}`, 5, 60_000);
    if (rl) return rl;

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id, user_id } = result;
    if (gym_id !== params.gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Tier gate: creating challenges requires the challenges feature.
    const access = await checkFeatureAccess(gym_id, 'challenges');
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.upgradeMessage }, { status: 403 });
    }

    const parsed = createChallengeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { title, description, challenge_type, start_date, end_date, prize_description } = parsed.data;

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
