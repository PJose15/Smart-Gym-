import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { otpSchema, otpLoginSchema } from '@/lib/validation/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Dev-only deterministic password used to mint a real session for the OTP dev
// bypass (so cookies get set exactly like the production path). Gated behind
// NODE_ENV !== production && NEXT_PUBLIC_DEV_OTP, so it never runs in prod.
const DEV_PASSWORD = 'dev-nexera-session-000000';

/**
 * POST /api/auth/verify
 *
 * Verifies a phone OTP and — critically — establishes a cookie session on the
 * response (Stage 2 / INT-C1). Two modes:
 *   • Scan/onboard (body has gym_id): verify → set session → find-or-create the
 *     member in that gym (links a pre-registered record on first verify).
 *   • Login (no gym_id): verify → set session → resolve the existing member by
 *     user_id. Returning members signing in on the web companion.
 *
 * Dev mode (NODE_ENV!=production && NEXT_PUBLIC_DEV_OTP=true): accepts "123456"
 * and mints a session via a deterministic dev password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Login mode when no gym_id is supplied (returning-member sign-in).
    const isLogin = !body?.gym_id;

    let phone: string;
    let code: string;
    let gym_id: string | undefined;
    let name: string | undefined;

    if (isLogin) {
      const parsed = otpLoginSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid input' },
          { status: 400 }
        );
      }
      phone = parsed.data.phone;
      code = parsed.data.code;
    } else {
      const parsed = otpSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid input' },
          { status: 400 }
        );
      }
      phone = parsed.data.phone;
      code = parsed.data.code;
      gym_id = parsed.data.gym_id;
      name = parsed.data.name;
    }

    // Pre-auth: per-IP overall cap + per-IP+phone cap (see auth/lookup BE-H6).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipLimited = checkRateLimit(`auth-verify-ip:${ip}`, 30, 900_000);
    if (ipLimited) return ipLimited;
    const limited = checkRateLimit(`auth-verify:${ip}:${phone}`, 10, 900_000);
    if (limited) return limited;

    const admin = getAdminClient();
    // Cookie-bound client: verifyOtp / signInWithPassword on this instance write
    // the auth cookies onto the response, which every downstream API reads.
    const supa = await createServerSupabaseClient();

    // Double-gate: BOTH must be true. Production can never use the dev bypass.
    const isDev =
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_DEV_OTP === 'true';

    let userId: string;

    if (isDev) {
      if (code !== '123456') {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
      }

      // Establish a real session for local testing. We mint it via a synthetic
      // EMAIL grant (always enabled) rather than phone-password, which many
      // projects don't enable. The tricky part: Supabase stores phone without a
      // leading '+', and seeded members' auth users often carry no phone at all
      // — so we resolve the target auth user from the members table (phone ->
      // user_id) first, only falling back to auth-user matching, then create.
      const devEmail = `dev-${phone.replace(/\D/g, '')}@nexera.dev`;
      const bare = phone.replace(/^\+/, '');
      let targetUserId: string | null = null;

      // Prefer the linked member's real auth user (works for login + returning).
      const { data: memberByPhone } = await admin
        .from('members')
        .select('user_id')
        .eq('phone', phone)
        .eq('is_active', true)
        .maybeSingle();
      if (memberByPhone?.user_id) targetUserId = memberByPhone.user_id as string;

      // Otherwise match an existing auth user (phone stored with or without '+').
      if (!targetUserId) {
        const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = existingUsers?.users?.find(
          (u) => u.phone === bare || u.phone === phone || u.email === devEmail
        );
        if (existingUser) targetUserId = existingUser.id;
      }

      if (targetUserId) {
        await admin.auth.admin.updateUserById(targetUserId, {
          email: devEmail,
          email_confirm: true,
          password: DEV_PASSWORD,
        });
        userId = targetUserId;
      } else if (isLogin) {
        // No linked member/user for this number — nothing to sign into.
        return NextResponse.json({ error: 'No membership found for this number.' }, { status: 404 });
      } else {
        // Scan/onboard cold path — create a fresh dev user.
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: true,
          email: devEmail,
          email_confirm: true,
          password: DEV_PASSWORD,
          user_metadata: { display_name: name || 'Dev User', gym_id },
        });
        if (createError || !newUser.user) {
          console.error('Dev user creation error:', createError?.message ?? 'Unknown error');
          return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }
        userId = newUser.user.id;
      }

      const { error: signInError } = await supa.auth.signInWithPassword({
        email: devEmail,
        password: DEV_PASSWORD,
      });
      if (signInError) {
        console.error('Dev sign-in error:', signInError.message);
        return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
      }
    } else {
      // Production: verify OTP on the cookie client so the session persists.
      const { data: verifyData, error: verifyError } = await supa.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (verifyError || !verifyData.user) {
        const message = verifyError?.message?.includes('expired')
          ? 'Code expired. Please request a new one.'
          : 'Invalid verification code';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      userId = verifyData.user.id;
    }

    // Resolve the member record.
    const member = isLogin
      ? await findMemberByUser(admin, userId)
      : await findOrCreateMember(admin, { userId, phone, name: name || 'Member', gymId: gym_id! });

    if (!member) {
      // Login mode with no membership vs. failed create in scan mode.
      return isLogin
        ? NextResponse.json({ error: 'No membership found for this number.' }, { status: 404 })
        : NextResponse.json({ error: 'Failed to set up member profile' }, { status: 500 });
    }

    // Read weight unit preference (default 'lbs'; missing row never breaks flow).
    const { data: settings } = await admin
      .from('member_settings')
      .select('weight_unit')
      .eq('member_id', member.id)
      .maybeSingle();

    const weight_unit: 'lbs' | 'kg' = settings?.weight_unit === 'kg' ? 'kg' : 'lbs';

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        user_id: member.user_id,
        display_name: member.display_name,
        first_name: member.first_name,
        phone: member.phone,
        primary_goal: member.primary_goal,
        experience_level: member.experience_level,
        onboarding_status: member.onboarding_status,
        gym_id: member.gym_id,
        weight_unit,
      },
    });
  } catch (err) {
    console.error('Verify error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface MemberInput {
  userId: string;
  phone: string;
  name: string;
  gymId: string;
}

interface MemberRecord {
  id: string;
  user_id: string | null;
  display_name: string;
  first_name: string | null;
  phone: string | null;
  primary_goal: string | null;
  experience_level: string | null;
  onboarding_status: string;
  gym_id: string;
}

const MEMBER_COLS =
  'id, user_id, display_name, first_name, phone, primary_goal, experience_level, onboarding_status, gym_id';

/** Login mode: resolve an already-linked member by their auth user id. */
async function findMemberByUser(
  admin: SupabaseClient,
  userId: string
): Promise<MemberRecord | null> {
  const { data } = await admin
    .from('members')
    .select(MEMBER_COLS)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('joined_gym_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function findOrCreateMember(
  admin: SupabaseClient,
  input: MemberInput
): Promise<MemberRecord | null> {
  const { userId, phone, name, gymId } = input;

  // 1. Check for existing member by phone in this gym
  const { data: existing } = await admin
    .from('members')
    .select(MEMBER_COLS)
    .eq('gym_id', gymId)
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    // If preloaded (no user_id), link the auth user
    if (existing.user_id === null) {
      const { data: updated, error: updateError } = await admin
        .from('members')
        .update({
          user_id: userId,
          onboarding_status:
            (existing.onboarding_status === 'pending' || existing.onboarding_status === 'invited')
              ? 'in_progress'
              : existing.onboarding_status,
        })
        .eq('id', existing.id)
        .select(MEMBER_COLS)
        .single();

      if (updateError) {
        console.error('Member link error:', updateError?.message ?? 'Unknown error');
        return null;
      }
      return updated;
    }

    // Already linked — return as-is
    return existing;
  }

  // 2. No existing member — create new one (cold path)
  const { data: created, error: createError } = await admin
    .from('members')
    .insert({
      gym_id: gymId,
      user_id: userId,
      display_name: name,
      first_name: name.split(' ')[0],
      phone,
      onboarding_status: 'in_progress',
    })
    .select(MEMBER_COLS)
    .single();

  if (createError) {
    console.error('Member creation error:', createError?.message ?? 'Unknown error');
    return null;
  }

  // 3. Create default member_settings
  await admin
    .from('member_settings')
    .insert({
      member_id: created.id,
      weight_unit: 'lbs',
    })
    .single();

  return created;
}
