import { NextRequest, NextResponse } from 'next/server';
import { sessionUpsertSchema } from '@/lib/validation/session';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/sessions
 * Upserts a workout session and appends a set.
 * Returns the session + updated sets array.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = sessionUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { gym_id, machine_id, member_id, session_date, workout_mode, set } = parsed.data;

    // Verify the authenticated user owns this member_id (cookie or Bearer JWT)
    const authResult = await verifyMember(member_id, request);
    if (authResult instanceof NextResponse) return authResult;

    const { admin } = authResult;

    const rl = checkRateLimit(`sessions-upsert:${member_id}`, 120, 60_000);
    if (rl) return rl;

    // Find existing session for this member+machine+date
    const { data: existing } = await admin
      .from('workout_sessions')
      .select('id, sets, sets_count, total_volume_lbs, best_weight_lbs, best_reps')
      .eq('member_id', member_id)
      .eq('machine_id', machine_id)
      .eq('session_date', session_date)
      .maybeSingle();

    const setEntry = {
      set_number: (existing?.sets_count || 0) + 1,
      weight_lbs: set.weight_lbs,
      reps: set.reps,
      rpe: set.rpe || null,
      notes: set.notes || null,
      logged_at: new Date().toISOString(),
    };

    const currentSets = existing ? [...(existing.sets as unknown[]), setEntry] : [setEntry];
    const setsCount = currentSets.length;
    const setVolume = set.weight_lbs * set.reps;
    const totalVolume = (existing?.total_volume_lbs || 0) + setVolume;
    const bestWeight = Math.max(existing?.best_weight_lbs || 0, set.weight_lbs);
    const bestReps =
      set.weight_lbs >= bestWeight
        ? Math.max(existing?.best_reps || 0, set.reps)
        : existing?.best_reps || set.reps;

    let sessionId: string;

    if (existing) {
      // Update existing session
      const { error: updateError } = await admin
        .from('workout_sessions')
        .update({
          sets: currentSets,
          sets_count: setsCount,
          total_volume_lbs: totalVolume,
          best_weight_lbs: bestWeight,
          best_reps: bestReps,
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Session update error:', updateError);
        return NextResponse.json({ error: 'Failed to log set' }, { status: 500 });
      }
      sessionId = existing.id;
    } else {
      // Create new session
      const { data: created, error: createError } = await admin
        .from('workout_sessions')
        .insert({
          gym_id,
          machine_id,
          member_id,
          session_date,
          workout_mode,
          sets: currentSets,
          sets_count: setsCount,
          total_volume_lbs: totalVolume,
          best_weight_lbs: bestWeight,
          best_reps: bestReps,
        })
        .select('id')
        .single();

      if (createError || !created) {
        console.error('Session create error:', createError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
      sessionId = created.id;
    }

    return NextResponse.json({
      session_id: sessionId,
      set_number: setEntry.set_number,
      sets: currentSets,
      sets_count: setsCount,
      total_volume_lbs: totalVolume,
      best_weight_lbs: bestWeight,
      best_reps: bestReps,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
