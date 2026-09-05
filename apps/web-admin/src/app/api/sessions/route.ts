import { NextRequest, NextResponse } from 'next/server';
import { sessionUpsertSchema } from '@/lib/validation/session';
import { verifyMember } from '@/lib/auth/verifyMember';
import { resolveMemberGym } from '@/lib/auth/tenant';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/sessions
 * Upserts a workout session and appends a set (atomic via the
 * append_session_set RPC — no read-modify-write race).
 * gym_id is derived from the verified member row; the body value is
 * ignored (BE-H2). machine_id must belong to that gym.
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

    const { machine_id, member_id, session_date, workout_mode, set } = parsed.data;

    // Verify the authenticated user owns this member_id (cookie or Bearer JWT)
    const authResult = await verifyMember(member_id, request);
    if (authResult instanceof NextResponse) return authResult;

    const { admin } = authResult;

    const rl = checkRateLimit(`sessions-upsert:${member_id}`, 120, 60_000);
    if (rl) return rl;

    // Tenant binding: gym comes from the member row, never the body
    const gymId = await resolveMemberGym(admin, member_id);
    if (!gymId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // The machine must exist in the member's gym
    const { data: machine } = await admin
      .from('machines')
      .select('id')
      .eq('id', machine_id)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });

    const { data: session, error: rpcError } = await admin.rpc('append_session_set', {
      p_member_id: member_id,
      p_gym_id: gymId,
      p_machine_id: machine_id,
      p_session_date: session_date,
      p_workout_mode: workout_mode,
      p_weight_lbs: set.weight_lbs,
      p_reps: set.reps,
      p_rpe: set.rpe ?? null,
      p_notes: set.notes ?? null,
    });

    if (rpcError || !session) {
      console.error('Session append error:', rpcError);
      return NextResponse.json({ error: 'Failed to log set' }, { status: 500 });
    }

    return NextResponse.json({
      session_id: session.id,
      set_number: session.sets_count,
      sets: session.sets,
      sets_count: session.sets_count,
      total_volume_lbs: session.total_volume_lbs,
      best_weight_lbs: session.best_weight_lbs,
      best_reps: session.best_reps,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
