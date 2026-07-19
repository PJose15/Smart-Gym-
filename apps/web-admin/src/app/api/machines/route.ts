import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkRateLimit } from '@/lib/rateLimit';
import { machineCreateSchema } from '@/lib/validation/machines';
import { generateQrSlug } from '@nexera/utils';
import { generateMachineMistakes } from '@nexera/ai-assist';

/**
 * POST /api/machines
 * Creates a new machine for the authenticated owner's gym.
 * - Auth: owner role required (verifyStaff)
 * - Rate limit: 20 creates per minute per user
 * - Server-side qr_slug generation (collision-retried)
 * - Server-side common_mistakes via template-based AI (pure function, no edge call)
 */
export async function POST(request: NextRequest) {
  // 1. Verify owner role
  const staffOrError = await verifyStaff('owner');
  if (staffOrError instanceof NextResponse) return staffOrError;
  const { user_id, gym_id, admin } = staffOrError;

  // 2. Rate limit
  const rl = checkRateLimit(`machines-create:${user_id}`, 20, 60_000);
  if (rl) return rl;

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = machineCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, target_muscles, movement_pattern, equipment_type, difficulty, setup_steps, safety_cues } =
    parsed.data;

  // 4. Fetch gym slug (needed for qr_slug generation)
  const { data: gym, error: gymError } = await admin
    .from('gyms')
    .select('slug')
    .eq('id', gym_id)
    .single();

  if (gymError || !gym) {
    return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
  }

  // 5. Generate server-side qr_slug
  const baseSlug = generateQrSlug(gym.slug, name);

  // 6. Generate common_mistakes via pure template function (no edge-function call from server)
  let common_mistakes: string[] = [];
  try {
    common_mistakes = await generateMachineMistakes({
      machineName: name,
      targetMuscles: target_muscles,
      setupSteps: setup_steps,
    });
  } catch {
    common_mistakes = [];
  }

  // 7. Insert — with collision retry on 23505
  const insertPayload = (qr_slug: string) => ({
    gym_id,
    name,
    qr_slug,
    target_muscles,
    setup_steps,
    safety_cues,
    common_mistakes,
    cue_version: 1,
    cue_source: common_mistakes.length > 0 ? 'template' : 'admin',
    movement_pattern,
    equipment_type,
    difficulty,
    primary_muscles: target_muscles,
    secondary_muscles: [] as string[],
  });

  let result = await admin
    .from('machines')
    .insert(insertPayload(baseSlug))
    .select('id, name, qr_slug')
    .single();

  if (result.error?.code === '23505') {
    // Retry with a 4-character random suffix
    const suffix = Math.random().toString(36).slice(2, 6);
    const retrySlug = `${baseSlug}-${suffix}`;
    result = await admin
      .from('machines')
      .insert(insertPayload(retrySlug))
      .select('id, name, qr_slug')
      .single();
  }

  if (result.error) {
    console.error('[POST /api/machines] insert error:', result.error);
    return NextResponse.json({ error: 'Failed to create machine' }, { status: 500 });
  }

  return NextResponse.json(result.data, { status: 201 });
}
