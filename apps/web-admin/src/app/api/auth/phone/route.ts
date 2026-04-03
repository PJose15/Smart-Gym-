import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { phoneSchema } from '@/lib/validation/auth';
import { checkRateLimit } from '@/lib/rateLimit';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/auth/phone
 * Sends OTP to the provided phone number via Supabase Auth.
 * In dev mode (NEXT_PUBLIC_DEV_OTP=true), skips real OTP.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = phoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { phone, name, gym_id } = parsed.data;

    const limited = checkRateLimit(`auth-phone:${phone}`, 5, 900_000);
    if (limited) return limited;

    const isDev = process.env.NEXT_PUBLIC_DEV_OTP === 'true';

    if (isDev) {
      // Dev bypass — no real OTP sent, code "123456" will be accepted
      return NextResponse.json({
        success: true,
        dev: true,
        message: 'Dev mode: use code 123456',
      });
    }

    // Production: send OTP via Supabase Auth
    const admin = getAdminClient();

    const { error } = await admin.auth.signInWithOtp({
      phone,
      options: {
        data: {
          display_name: name,
          gym_id,
        },
      },
    });

    if (error) {
      console.error('OTP send error:', error);

      if (error.message?.includes('rate')) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a moment.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dev: false,
      message: 'Verification code sent',
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
