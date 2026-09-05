/**
 * Edge Function: POST /trainer-copilot/generate-workout-draft
 * Body: { workout_id } — a workout_sessions.id
 *
 * Generates a coach note draft from a completed workout session.
 * Caller must be trainer/owner in the gym.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function handleGenerateWorkoutDraft(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers });
    }

    // Create client with caller's JWT for RLS
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for admin operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get caller identity
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const { workout_id } = await req.json();
    if (!workout_id) {
      return new Response(JSON.stringify({ error: 'workout_id is required' }), { status: 400, headers });
    }

    // Fetch workout session
    const { data: session, error: sessionError } = await serviceClient
      .from('workout_sessions')
      .select('id, gym_id, machine_id, member_id, session_date, workout_mode, sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps, completed_at')
      .eq('id', workout_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404, headers });
    }

    // Resolve member identity (workout_sessions.member_id → members → users.id)
    const { data: member, error: memberError } = await serviceClient
      .from('members')
      .select('id, user_id, display_name')
      .eq('id', session.member_id)
      .single();

    if (memberError || !member || !member.user_id) {
      return new Response(JSON.stringify({ error: 'Member not found' }), { status: 404, headers });
    }

    const memberProfileId = member.user_id;

    // Verify caller is trainer/owner in this gym
    const { data: membership } = await serviceClient
      .from('gym_members')
      .select('role')
      .eq('gym_id', session.gym_id)
      .eq('profile_id', user.id)
      .in('role', ['owner', 'trainer'])
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not authorized for this gym' }), { status: 403, headers });
    }

    // Find trainer assignment for this member
    const { data: assignment } = await serviceClient
      .from('trainer_assignments')
      .select('trainer_profile_id')
      .eq('gym_id', session.gym_id)
      .eq('member_profile_id', memberProfileId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const trainerProfileId = assignment?.trainer_profile_id ?? user.id;

    // Check for existing draft (idempotency)
    const { data: existingDraft } = await serviceClient
      .from('coach_note_drafts')
      .select('id, status')
      .eq('gym_id', session.gym_id)
      .eq('member_profile_id', memberProfileId)
      .eq('workout_id', workout_id)
      .limit(1)
      .maybeSingle();

    if (existingDraft) {
      return new Response(JSON.stringify({
        draft_id: existingDraft.id,
        status: existingDraft.status,
        message: 'Draft already exists for this workout',
      }), { status: 200, headers });
    }

    const memberName = member.display_name ?? 'Member';

    // Fetch machine name (best-effort; used in draft text)
    let machineName = 'machine';
    if (session.machine_id) {
      const { data: machine } = await serviceClient
        .from('machines')
        .select('name')
        .eq('id', session.machine_id)
        .maybeSingle();
      if (machine?.name) machineName = machine.name;
    }

    // Aggregate from the session's JSONB sets array (weights stored in lbs)
    const sessionSets: Array<{ weight_lbs?: number; reps?: number }> = Array.isArray(session.sets) ? session.sets : [];
    const totalSets = sessionSets.length;
    let totalVolume = 0;
    let totalReps = 0;

    for (const s of sessionSets) {
      const wlbs = Number(s.weight_lbs) || 0;
      const reps = Number(s.reps) || 0;
      totalVolume += wlbs * reps;
      totalReps += reps;
    }

    // Fetch training profile
    const { data: trainingProfile } = await serviceClient
      .from('user_training_profiles')
      .select('goal, experience')
      .eq('profile_id', memberProfileId)
      .eq('gym_id', session.gym_id)
      .limit(1)
      .maybeSingle();

    // Fetch guardrails (latest)
    const { data: guardrailRows } = await serviceClient
      .from('ai_guardrail_insights')
      .select('insight_type, severity, message, recommended_action')
      .eq('profile_id', memberProfileId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    const guardrails = (guardrailRows ?? []).map((g: any) => ({
      insight_type: g.insight_type,
      severity: g.severity,
      confidence: 0.7,
      message: g.message,
      recommended_action: g.recommended_action,
    }));

    // Build deterministic draft
    const prSummaries: Array<{ exercise: string; type: string; value: number }> = [];
    const guardrailSignals = guardrails.map((g: any) => ({
      type: g.insight_type,
      severity: g.severity,
      message: g.message,
    }));

    // Simple draft construction (mirrors buildWorkoutDraft logic; canonical unit = lbs)
    const sections: string[] = [];
    const vol = Math.round(totalVolume);

    sections.push(`${memberName} completed a ${machineName} session with ${totalSets} sets and ${vol} lbs total volume.`);

    if (totalSets > 0) {
      sections.push(
        trainingProfile?.goal === 'strength'
          ? 'Prioritize heavier loads with longer rest (2-3 min) to maintain quality on working sets.'
          : 'Keep focusing on controlled reps with moderate rest periods.',
      );
    }

    if (guardrails.length > 0) {
      sections.push('Next session: take it a bit easier. Focus on form and listen to your body.');
    } else {
      sections.push('Next session: aim to match or slightly beat these numbers. Small, consistent gains add up.');
    }

    const draft_title = guardrails.length > 0
      ? 'Session notes — a few things to watch'
      : 'Good session — keep it up';

    // Confidence
    let confidence = 0.3;
    if (totalSets > 0) confidence += 0.15;
    if (trainingProfile?.goal) confidence += 0.1;
    if (trainingProfile?.experience) confidence += 0.05;
    if (guardrails.length > 0) confidence += 0.1;
    if (totalSets >= 8) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);

    const signals = {
      prs: prSummaries,
      volume_change_pct: null,
      total_sets: totalSets,
      total_reps: totalReps,
      total_volume_lbs: totalVolume,
      guardrails: guardrailSignals,
      goal: trainingProfile?.goal,
      experience: trainingProfile?.experience,
    };

    // Insert draft
    const { data: draft, error: draftError } = await serviceClient
      .from('coach_note_drafts')
      .insert({
        gym_id: session.gym_id,
        trainer_profile_id: trainerProfileId,
        member_profile_id: memberProfileId,
        workout_id: workout_id,
        draft_title,
        draft_body: sections.join('\n\n'),
        confidence,
        signals,
        status: 'pending',
      })
      .select('id')
      .single();

    if (draftError) {
      // Handle unique constraint violation (idempotency)
      if (draftError.code === '23505') {
        const { data: existing } = await serviceClient
          .from('coach_note_drafts')
          .select('id, status')
          .eq('workout_id', workout_id)
          .eq('member_profile_id', memberProfileId)
          .maybeSingle();
        return new Response(JSON.stringify({
          draft_id: existing?.id,
          status: existing?.status,
          message: 'Draft already exists',
        }), { status: 200, headers });
      }
      console.error('Failed to create draft:', draftError);
      return new Response(JSON.stringify({ error: 'Failed to create draft' }), { status: 500, headers });
    }

    // Log action
    const { error: actionErr } = await serviceClient.from('coach_note_actions').insert({
      gym_id: session.gym_id,
      draft_id: draft.id,
      actor_profile_id: user.id,
      action: 'generated',
      meta: { workout_id, source: 'api' },
    });
    if (actionErr) console.error('Failed to log generate action:', actionErr);

    return new Response(JSON.stringify({
      draft_id: draft.id,
      draft_title,
      confidence,
      message: 'Draft generated successfully',
    }), { status: 201, headers });

  } catch (err) {
    console.error('generate-workout-draft error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
