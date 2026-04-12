import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

const KG_TO_LBS = 2.20462262;

const BODY_METRICS_COLS =
  'id, member_id, gym_id, logged_at, weight_lbs, body_fat_pct, chest_in, waist_in, hips_in, left_arm_in, right_arm_in, left_thigh_in, right_thigh_in, left_calf_in, right_calf_in, neck_in, shoulders_in, notes';

const bodyMetricsSchema = z
  .object({
    weight_lbs: z.number().positive().max(2000).optional(),
    weight_kg: z.number().positive().max(900).optional(),
    body_fat_pct: z.number().min(0).max(70).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.weight_lbs !== undefined || v.weight_kg !== undefined, {
    message: 'weight_lbs or weight_kg required',
  });

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const url = req.nextUrl.searchParams;
    const limit = Math.min(Number(url.get('limit')) || 30, 100);
    const offset = Number(url.get('offset')) || 0;

    const { data, error } = await admin
      .from('body_metrics')
      .select(BODY_METRICS_COLS)
      .eq('member_id', params.memberId)
      .order('logged_at', { ascending: false })
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
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const rl = checkRateLimit(`body-metrics:${params.memberId}`, 10, 60_000);
    if (rl) return rl;

    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin, member_id } = auth;

    const parsed = bodyMetricsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { weight_lbs, weight_kg, body_fat_pct, notes } = parsed.data;

    // Resolve gym_id (required NOT NULL on body_metrics)
    const { data: member } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', member_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Convert kg to lbs for storage if only kg provided
    const storedLbs = weight_lbs ?? (weight_kg ? Math.round(weight_kg * KG_TO_LBS * 100) / 100 : null);

    const { data, error } = await admin
      .from('body_metrics')
      .insert({
        member_id,
        gym_id: member.gym_id,
        weight_lbs: storedLbs,
        body_fat_pct: body_fat_pct ?? null,
        notes: notes ?? null,
      })
      .select(BODY_METRICS_COLS)
      .single();

    if (error) return NextResponse.json({ error: 'Failed to log metrics' }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
