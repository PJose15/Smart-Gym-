import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { otpSchema } from '@/lib/validation/auth';
import { checkRateLimit } from '@/lib/rateLimit';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/auth/verify
 * Verifies OTP code, creates or links member record, returns member data.
 *
 * Dev mode: accepts code "123456" and creates a mock user/session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = otpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { phone, code, gym_id, name } = parsed.data;

    const limited = checkRateLimit(`auth-verify:${phone}`, 10, 900_000);
    if (limited) return limited;

    const admin = getAdminClient();
    // Double-gate: BOTH conditions must be true. Production can never use dev bypass.
    const isDev =
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_DEV_OTP === 'true';

    let userId: string;

    if (isDev) {
      // Dev bypass: accept "123456", create/find a deterministic dev user
      if (code !== '123456') {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }

      // Check if a dev user already exists for this phone
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.phone === phone
      );

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create user via admin API
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: true,
          user_metadata: { display_name: name || 'Dev User', gym_id },
        });

        if (createError || !newUser.user) {
          console.error('Dev user creation error:', createError?.message ?? 'Unknown error');
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
          );
        }
        userId = newUser.user.id;
      }
    } else {
      // Production: verify OTP via Supabase Auth
      const { data: verifyData, error: verifyError } = await admin.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (verifyError || !verifyData.user) {
        const message = verifyError?.message?.includes('expired')
          ? 'Code expired. Please request a new one.'
          : 'Invalid verification code';

        return NextResponse.json(
          { error: message },
          { status: 400 }
        );
      }
      userId = verifyData.user.id;
    }

    // Now find or create/link the member record
    const member = await findOrCreateMember(admin, {
      userId,
      phone,
      name: name || 'Member',
      gymId: gym_id,
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Failed to set up member profile' },
        { status: 500 }
      );
    }

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
      },
    });
  } catch (err) {
    console.error('Verify error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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

async function findOrCreateMember(
  admin: SupabaseClient,
  input: MemberInput
): Promise<MemberRecord | null> {
  const { userId, phone, name, gymId } = input;

  // 1. Check for existing member by phone in this gym
  const { data: existing } = await admin
    .from('members')
    .select('id, user_id, display_name, first_name, phone, primary_goal, experience_level, onboarding_status, gym_id')
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
            existing.onboarding_status === 'pending'
              ? 'in_progress'
              : existing.onboarding_status,
        })
        .eq('id', existing.id)
        .select('id, user_id, display_name, first_name, phone, primary_goal, experience_level, onboarding_status, gym_id')
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
    .select('id, user_id, display_name, first_name, phone, primary_goal, experience_level, onboarding_status, gym_id')
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
