import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateSlug } from '@nexera/utils';
import { onboardRegisterSchema } from '@/lib/validation/onboard';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { runAfterResponse } from '@/lib/asyncWork';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per IP per 10 minutes
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rateLimited = checkRateLimit(`onboard-register:${ip}`, 5, 600_000);
  if (rateLimited) return rateLimited;

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = onboardRegisterSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = issues as string[];
    }
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

  const { owner_name, email, password, gym_name, city, gym_type } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Step 1: Use anon server client to signUp (sends confirmation email automatically)
  const supabase = await createServerSupabaseClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/subscribe`,
      data: { display_name: owner_name },
    },
  });

  if (signUpError) {
    console.error('[onboard/register] signUp error:', signUpError.message);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  // Detect duplicate email: Supabase returns an obfuscated "fake" user with empty identities array
  if (!signUpData.user || (signUpData.user.identities?.length ?? 0) === 0) {
    return NextResponse.json(
      { error: 'An account with this email already exists.' },
      { status: 409 }
    );
  }

  const userId = signUpData.user.id;
  const admin = getAdminClient();

  // Step 2: Insert users row with gym_owner role
  const { error: insertError } = await admin.from('users').insert({
    id: userId,
    email,
    display_name: owner_name,
    platform_role: 'gym_owner',
  });

  if (insertError) {
    console.error('[onboard/register] users insert error:', insertError.message);
    // Rollback: delete the orphaned auth user
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (deleteErr) {
      console.error('[onboard/register] rollback deleteUser failed:', deleteErr);
    }
    return NextResponse.json({ error: 'Failed to complete registration. Please try again.' }, { status: 500 });
  }

  // Step 3: Atomically create gym + membership + settings + billing via RPC
  const { data: gymId, error: rpcError } = await admin.rpc('complete_gym_onboarding', {
    p_user_id: userId,
    p_gym_name: gym_name,
    p_gym_slug: generateSlug(gym_name),
    p_gym_city: city ?? null,
    p_gym_type: gym_type,
    p_tier: 'starter',
  });

  if (rpcError) {
    console.error('[onboard/register] complete_gym_onboarding RPC error:', rpcError.message);
    // Rollback: delete the orphaned auth user
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (deleteErr) {
      console.error('[onboard/register] rollback deleteUser failed:', deleteErr);
    }
    return NextResponse.json({ error: 'Failed to set up gym. Please try again.' }, { status: 500 });
  }

  // Fire-and-forget growth-agent event after successful gym creation.
  // PLATFORM_EVENT: new gyms are 'starter' tier — the trigger route bypasses checkAgentAccess
  // for this event (see trigger route cooldown.ts rationale). No dedup_key needed: 30-day
  // cooldown per (gym, event) makes this once-per-gym in practice. No owner PII in payload.
  runAfterResponse(triggerUptimizeAIAgent('growth-agent', {
    event: 'new-gym-onboarded',
    gym_id: gymId,
    gym_name: gym_name,
    gym_type: gym_type,
    is_agent_initiated: false,
  }).catch((err: unknown) => {
    console.error('[onboard/register] new-gym-onboarded trigger failed:', err);
  }));

  return NextResponse.json({ gym_id: gymId, email });
}
