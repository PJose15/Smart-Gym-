import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const onboardSchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
  primary_goal: z.enum(['muscle-gain', 'strength', 'weight-loss', 'endurance', 'general-fitness']),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'athlete']),
});

/**
 * POST /api/members/onboard
 * Updates member with goal + experience, sets onboarding_status to 'active',
 * creates member_settings (if missing) and logs onboarding_events.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = onboardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { member_id, gym_id, primary_goal, experience_level } = parsed.data;
    const admin = getAdminClient();

    // Update member record
    const { error: updateError } = await admin
      .from('members')
      .update({
        primary_goal,
        experience_level,
        onboarding_status: 'active',
      })
      .eq('id', member_id)
      .eq('gym_id', gym_id);

    if (updateError) {
      console.error('Onboard update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Ensure member_settings exists (upsert)
    await admin
      .from('member_settings')
      .upsert(
        { member_id, weight_unit: 'lbs' },
        { onConflict: 'member_id' }
      );

    // Log onboarding events
    const sessionId = `onboard_${member_id}_${Date.now()}`;
    const events = [
      {
        session_id: sessionId,
        gym_id,
        member_id,
        event_type: 'goal_selected',
        event_data: { goal: primary_goal },
      },
      {
        session_id: sessionId,
        gym_id,
        member_id,
        event_type: 'experience_selected',
        event_data: { experience: experience_level },
      },
      {
        session_id: sessionId,
        gym_id,
        member_id,
        event_type: 'welcome_seen',
        event_data: {},
      },
    ];

    await admin.from('onboarding_events').insert(events);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
