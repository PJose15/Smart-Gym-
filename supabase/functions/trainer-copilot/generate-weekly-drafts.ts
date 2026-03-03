/**
 * Edge Function: POST /trainer-copilot/generate-weekly-drafts
 * Body: { gym_id, period_start, period_end }
 *
 * Generates weekly check-in drafts for all active assignments in a gym.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { gym_id, period_start, period_end } = await req.json();
    if (!gym_id || !period_start || !period_end) {
      return new Response(JSON.stringify({ error: 'gym_id, period_start, and period_end are required' }), { status: 400 });
    }

    // Verify caller is trainer/owner in this gym
    const { data: membership } = await serviceClient
      .from('gym_members')
      .select('role')
      .eq('gym_id', gym_id)
      .eq('profile_id', user.id)
      .in('role', ['owner', 'trainer'])
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not authorized for this gym' }), { status: 403 });
    }

    // Fetch all active assignments in this gym
    const { data: assignments } = await serviceClient
      .from('trainer_assignments')
      .select('trainer_profile_id, member_profile_id')
      .eq('gym_id', gym_id)
      .eq('status', 'active')
      .limit(500);

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: 'No active assignments' }), { status: 200 });
    }

    let generated = 0;

    for (const assignment of assignments) {
      // Check if draft already exists for this period (idempotency)
      const { data: existingDraft } = await serviceClient
        .from('coach_note_drafts')
        .select('id')
        .eq('gym_id', gym_id)
        .eq('member_profile_id', assignment.member_profile_id)
        .eq('period_start', period_start)
        .eq('period_end', period_end)
        .limit(1)
        .single();

      if (existingDraft) continue;

      // Fetch member profile
      const { data: memberProfile } = await serviceClient
        .from('profiles')
        .select('full_name')
        .eq('id', assignment.member_profile_id)
        .single();

      const memberName = memberProfile?.full_name ?? 'Member';

      // Count workouts in period
      const { data: workouts } = await serviceClient
        .from('workouts')
        .select('id, started_at, status')
        .eq('profile_id', assignment.member_profile_id)
        .eq('gym_id', gym_id)
        .eq('status', 'completed')
        .gte('started_at', period_start)
        .lte('started_at', period_end + 'T23:59:59Z');

      const workoutCount = workouts?.length ?? 0;

      // Count unique active days
      const activeDays = new Set(
        (workouts ?? []).map((w: any) => new Date(w.started_at).toISOString().slice(0, 10)),
      ).size;

      // Fetch training profile
      const { data: trainingProfile } = await serviceClient
        .from('user_training_profiles')
        .select('goal, experience, units')
        .eq('profile_id', assignment.member_profile_id)
        .eq('gym_id', gym_id)
        .limit(1)
        .single();

      // Build simple weekly draft
      const unitLabel = trainingProfile?.units === 'lbs' ? 'lbs' : 'kg';
      const sections: string[] = [];

      const startDate = new Date(period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endDate = new Date(period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const periodLabel = `this week (${startDate} – ${endDate})`;

      if (workoutCount === 0) {
        sections.push(`${memberName} didn't log any workouts ${periodLabel}. Let's check in and see how things are going.`);
        sections.push('No worries if the schedule was tight. The important thing is getting back on track when you can.');
        sections.push('When you\'re ready, let\'s start with a lighter session to ease back in.');
      } else {
        sections.push(`${memberName} logged ${workoutCount} workout${workoutCount > 1 ? 's' : ''} across ${activeDays} day${activeDays > 1 ? 's' : ''} ${periodLabel}.`);
        if (workoutCount >= 3) {
          sections.push(`${workoutCount} sessions this week — excellent commitment.`);
        }
        sections.push('Next session: aim to match or slightly beat these numbers. Small, consistent gains add up.');
      }

      const draft_title = workoutCount === 0
        ? 'Weekly check-in — let\'s reconnect'
        : 'Weekly recap — solid week';

      let confidence = 0.3;
      if (workoutCount > 0) confidence += 0.15;
      if (workoutCount >= 3) confidence += 0.1;
      if (trainingProfile?.goal) confidence += 0.1;
      confidence = Math.min(confidence, 0.95);

      const signals = {
        workouts_in_period: workoutCount,
        streak_days: activeDays,
        goal: trainingProfile?.goal,
        experience: trainingProfile?.experience,
      };

      const { data: draft, error: draftError } = await serviceClient
        .from('coach_note_drafts')
        .insert({
          gym_id,
          trainer_profile_id: assignment.trainer_profile_id,
          member_profile_id: assignment.member_profile_id,
          period_start,
          period_end,
          draft_title,
          draft_body: sections.join('\n\n'),
          confidence,
          signals,
          status: 'pending',
        })
        .select('id')
        .single();

      if (draftError) {
        // Skip on unique constraint violation
        if (draftError.code === '23505') continue;
        continue;
      }

      // Log action
      await serviceClient.from('coach_note_actions').insert({
        gym_id,
        draft_id: draft.id,
        actor_profile_id: user.id,
        action: 'generated',
        meta: { period_start, period_end, source: 'weekly_batch' },
      });

      generated++;
    }

    return new Response(JSON.stringify({ generated, total_assignments: assignments.length }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
