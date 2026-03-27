import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { member_id, gym_id } = await request.json();

    if (!member_id || !gym_id) {
      return NextResponse.json({ eligible: false, reason: 'missing_params' });
    }

    const admin = getAdminClient();

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
