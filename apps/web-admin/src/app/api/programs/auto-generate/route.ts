import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uuidString } from '@/lib/validation/uuid';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkFeatureAccess } from '@/lib/billing/featureGate';

const autoGenerateSchema = z.object({
  member_id: uuidString,
  // Accepted for backward compatibility but IGNORED — the gym is derived
  // from the verified member row (AI-M6 / Stage 5 tenant binding).
  gym_id: uuidString.optional(),
});

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/programs/auto-generate
 * Body: { member_id, gym_id }
 *
 * Checks eligibility then triggers AI program generation:
 * - 3+ total sessions
 * - 2+ distinct machines used
 * - No active program
 * - Feature flag ai_program_gen enabled
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = autoGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ eligible: false, reason: 'missing_params' }, { status: 400 });
    }
    const { member_id } = parsed.data;

    const admin = getAdminClient();

    // Verify caller owns this member
    const { data: memberCheck } = await admin
      .from('members')
      .select('id, gym_id')
      .eq('id', member_id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!memberCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Tenant binding: all gym-scoped reads/writes below use the gym derived
    // from the verified member row — never the request body (AI-M6).
    const gym_id = memberCheck.gym_id;

    // Rate limit AFTER auth, keyed on the authenticated member (M-9)
    const rl = checkRateLimit(`auto-generate:${member_id}`, 3, 300_000);
    if (rl) return rl;

    // Tier gate: AI program generation requires ai_programs. Resolve gym_id from
    // the member record (server-derived), not client input.
    const access = await checkFeatureAccess(gym_id, 'ai_programs');
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.upgradeMessage }, { status: 403 });
    }

    // Check feature flag
    const { data: flag } = await admin
      .from('feature_flags')
      .select('is_enabled')
      .eq('flag_key', 'ai_program_gen')
      .maybeSingle();

    if (!flag || flag.is_enabled === false) {
      return NextResponse.json({ eligible: false, reason: 'feature_disabled' });
    }

    // Check: no active program already
    const { data: activePrograms } = await admin
      .from('ai_programs')
      .select('id')
      .eq('member_id', member_id)
      .eq('is_active', true)
      .limit(1);

    if (activePrograms && activePrograms.length > 0) {
      return NextResponse.json({ eligible: false, reason: 'active_program_exists' });
    }

    // Check: 3+ total sessions
    const { count: sessionCount } = await admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', member_id);

    if ((sessionCount ?? 0) < 3) {
      return NextResponse.json({ eligible: false, reason: 'insufficient_sessions' });
    }

    // Check: 2+ distinct machines
    const { data: machines } = await admin
      .from('workout_sessions')
      .select('machine_id')
      .eq('member_id', member_id);

    const distinctMachines = new Set((machines ?? []).map((m) => m.machine_id));
    if (distinctMachines.size < 2) {
      return NextResponse.json({ eligible: false, reason: 'insufficient_machines' });
    }

    // Fetch member for goal/experience
    const { data: member } = await admin
      .from('members')
      .select('primary_goal, experience_level')
      .eq('id', member_id)
      .single();

    if (!member) {
      return NextResponse.json({ eligible: false, reason: 'member_not_found' });
    }

    // Fetch gym machines for the program
    const { data: gymMachines } = await admin
      .from('machines')
      .select('id, name, muscle_groups')
      .eq('gym_id', gym_id)
      .eq('is_active', true);

    if (!gymMachines || gymMachines.length === 0) {
      return NextResponse.json({ eligible: false, reason: 'no_machines' });
    }

    // Call edge function to generate program
    const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-generate`;
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        action: 'generate_program',
        payload: {
          goal: member.primary_goal ?? 'general fitness',
          experience: member.experience_level ?? 'beginner',
          daysPerWeek: 3,
          limitations: [],
          availableMachines: gymMachines.map((m) => ({
            id: m.id,
            name: m.name,
            target_muscles: m.muscle_groups ?? [],
          })),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json({ eligible: true, reason: 'generation_failed' });
    }

    const json = await res.json();
    const programData = json.data;

    if (!programData?.name || !programData?.days?.length) {
      return NextResponse.json({ eligible: true, reason: 'empty_program' });
    }

    // Save to ai_programs
    const { data: program, error: insertError } = await admin
      .from('ai_programs')
      .insert({
        member_id,
        gym_id,
        title: programData.name,
        description: programData.description ?? '',
        goal: member.primary_goal ?? 'general fitness',
        experience_level: member.experience_level ?? 'beginner',
        duration_weeks: 4,
        sessions_per_week: programData.days.length,
        program_data: programData,
        sessions_total: programData.days.length * 4,
        generated_by: 'ai',
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !program) {
      console.error('[auto-generate] insert failed:', insertError?.message);
      return NextResponse.json({ eligible: true, reason: 'save_failed' });
    }

    return NextResponse.json({ eligible: true, program_id: program.id });
  } catch (err) {
    console.error('[auto-generate] error:', err);
    return NextResponse.json({ eligible: false, reason: 'error' }, { status: 500 });
  }
}
