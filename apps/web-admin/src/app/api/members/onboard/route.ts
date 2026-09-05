import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { uuidString } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendNotification } from '@/lib/notifications/dispatcher';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const onboardSchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = onboardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { member_id, gym_id, primary_goal, experience_level } = parsed.data;

    const rl = checkRateLimit(`onboard:${user.id}`, 5, 60_000);
    if (rl) return rl;

    const admin = getAdminClient();

    // Verify caller owns this member
    const { data: memberCheck } = await admin
      .from('members')
      .select('id')
      .eq('id', member_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!memberCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

    // Fire-and-forget: agent_welcome push to newly onboarded member.
    // Freshly onboarded members may have no device token yet — 'no_devices' result is expected and harmless.
    sendNotification({
      gym_id,
      member_id,
      type: 'agent_welcome',
      title: 'Welcome to your gym',
      body: 'You are all set. Scan any machine to start your first workout.',
      is_agent_initiated: true,
    }).catch(err =>
      console.error('[onboard] agent_welcome push failed:', err instanceof Error ? err.message : 'Unknown error')
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
