import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { lookupSchema } from '@/lib/validation/auth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/auth/lookup
 * Detects if a phone number belongs to an existing member.
 * Returns auth path: 'cold' | 'preloaded' | 'returning'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { phone, gym_id } = parsed.data;
    const admin = getAdminClient();

    // Look up member by phone in this gym
    const { data: member, error } = await admin
      .from('members')
      .select('id, user_id, display_name, first_name, onboarding_status, primary_goal, experience_level')
      .eq('gym_id', gym_id)
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Lookup error:', error);
      return NextResponse.json(
        { error: 'Lookup failed' },
        { status: 500 }
      );
    }

    if (!member) {
      // No match — cold path (new user)
      return NextResponse.json({
        path: 'cold' as const,
        member: null,
      });
    }

    if (member.user_id === null) {
      // Member exists but no auth user linked — preloaded by gym owner
      return NextResponse.json({
        path: 'preloaded' as const,
        member: {
          id: member.id,
          display_name: member.display_name,
          first_name: member.first_name,
        },
      });
    }

    if (member.onboarding_status === 'active' || member.onboarding_status === 'program_active') {
      // Fully onboarded returning member
      return NextResponse.json({
        path: 'returning' as const,
        member: {
          id: member.id,
          display_name: member.display_name,
          first_name: member.first_name,
          primary_goal: member.primary_goal,
          experience_level: member.experience_level,
        },
      });
    }

    // Member exists with user_id but onboarding not complete — treat as returning
    return NextResponse.json({
      path: 'returning' as const,
      member: {
        id: member.id,
        display_name: member.display_name,
        first_name: member.first_name,
        primary_goal: member.primary_goal,
        experience_level: member.experience_level,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
