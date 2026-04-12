import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';

const TIER_LIMITS: Record<string, number> = { starter: 5, growth: 25, pro: Infinity };

const machineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(50),
  muscle_groups: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  demo_video_url: z.string().url().max(500).nullable().optional(),
});

interface RouteParams {
  params: Promise<{ gymId: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { gymId } = await params;
    const uuidError = validateUUIDs({ gymId });
    if (uuidError) return uuidError;

    const rl = checkRateLimit(`create-machine:${gymId}`, 10, 60_000);
    if (rl) return rl;

    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;
    const { admin, gym_id } = result;

    if (gym_id !== gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = machineSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { name, category, muscle_groups, instructions, demo_video_url } = parsed.data;

    // Check tier limits
    const { data: gym } = await admin
      .from('gyms')
      .select('subscription_tier')
      .eq('id', gymId)
      .single();

    const limit = TIER_LIMITS[(gym?.subscription_tier || 'starter').toLowerCase()] ?? 5;

    const { count } = await admin
      .from('machines')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('is_active', true);

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Machine limit reached for your tier (${limit})` },
        { status: 403 }
      );
    }

    // Generate slug
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${Date.now().toString(36)}`;

    const { data: machine, error } = await admin
      .from('machines')
      .insert({
        gym_id: gymId,
        name,
        category,
        muscle_groups: muscle_groups ?? [],
        instructions: instructions ?? null,
        demo_video_url: demo_video_url ?? null,
        qr_slug: slug,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create machine' }, { status: 500 });
    return NextResponse.json(machine, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
