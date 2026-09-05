import { NextRequest, NextResponse } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import { verifyMember } from '@/lib/auth/verifyMember';
import { z } from 'zod';
import { uuidString } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

const prCheckSchema = z.object({
  session_id: uuidString,
  member_id: uuidString,
  machine_id: uuidString,
  weight_lbs: z.number().min(0),
  reps: z.number().int().min(1),
});

/**
 * POST /api/sessions/pr-check
 * Checks if a logged set is a PR by comparing against historical sessions.
 * Updates workout_sessions.is_personal_best and inserts gym_feed_events for PRs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = prCheckSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { session_id, member_id, machine_id, weight_lbs, reps } = parsed.data;

    // Verify the authenticated user owns this member_id (cookie or Bearer JWT)
    const authResult = await verifyMember(member_id, request);
    if (authResult instanceof NextResponse) return authResult;
    const { admin } = authResult;

    const rl = checkRateLimit(`pr-check:${member_id}`, 120, 60_000);
    if (rl) return rl;

    // BE-H1: the session must belong to this member AND this machine —
    // otherwise a caller could mark arbitrary sessions as PRs.
    const { data: ownedSession } = await admin
      .from('workout_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('member_id', member_id)
      .eq('machine_id', machine_id)
      .maybeSingle();
    if (!ownedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all previous sessions for this member on this machine (excluding current)
    const { data: history } = await admin
      .from('workout_sessions')
      .select('id, best_weight_lbs, total_volume_lbs, session_date')
      .eq('member_id', member_id)
      .eq('machine_id', machine_id)
      .neq('id', session_id)
      .order('session_date', { ascending: false })
      .limit(50);

    // First session on this machine = always a PR
    if (!history || history.length === 0) {
      await markPR(admin, session_id, member_id, 'first_session', weight_lbs, null);
      await insertFeedEvent(admin, session_id, member_id, machine_id, 'first_session');

      return NextResponse.json({
        pr: {
          type: 'first_session',
          value: weight_lbs,
          previousValue: null,
          improvementPct: null,
        },
      });
    }

    // Check weight PR
    const historicalBestWeight = Math.max(
      ...history.map((h) => h.best_weight_lbs || 0)
    );

    if (weight_lbs > historicalBestWeight && historicalBestWeight > 0) {
      const improvementPct =
        Math.round(((weight_lbs - historicalBestWeight) / historicalBestWeight) * 1000) / 10;

      await markPR(admin, session_id, member_id, 'weight', weight_lbs, historicalBestWeight);
      await insertFeedEvent(admin, session_id, member_id, machine_id, 'weight');

      return NextResponse.json({
        pr: {
          type: 'weight',
          value: weight_lbs,
          previousValue: historicalBestWeight,
          improvementPct,
        },
      });
    }

    // Check volume PR (current set volume vs historical best single-set volume)
    const currentVolume = weight_lbs * reps;
    const historicalBestVolume = Math.max(
      ...history.map((h) => h.total_volume_lbs || 0)
    );

    // Get current session's total volume
    const { data: currentSession } = await admin
      .from('workout_sessions')
      .select('total_volume_lbs')
      .eq('id', session_id)
      .single();

    const currentTotalVolume = currentSession?.total_volume_lbs || currentVolume;

    if (currentTotalVolume > historicalBestVolume && historicalBestVolume > 0) {
      const improvementPct =
        Math.round(((currentTotalVolume - historicalBestVolume) / historicalBestVolume) * 1000) / 10;

      await markPR(admin, session_id, member_id, 'volume', currentTotalVolume, historicalBestVolume);
      await insertFeedEvent(admin, session_id, member_id, machine_id, 'volume');

      return NextResponse.json({
        pr: {
          type: 'volume',
          value: currentTotalVolume,
          previousValue: historicalBestVolume,
          improvementPct,
        },
      });
    }

    // No PR
    return NextResponse.json({ pr: null });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function markPR(admin: SupabaseClient, sessionId: string, memberId: string, type: string, value: number, previousBest: number | null) {
  await admin
    .from('workout_sessions')
    .update({
      is_personal_best: true,
      personal_best_type: type,
      pr_improvement_lbs: previousBest !== null ? value - previousBest : null,
      pr_improvement_pct: previousBest !== null && previousBest > 0
        ? Math.round(((value - previousBest) / previousBest) * 1000) / 10
        : null,
      previous_best_lbs: previousBest,
    })
    .eq('id', sessionId)
    .eq('member_id', memberId);
}

async function insertFeedEvent(admin: SupabaseClient, sessionId: string, memberId: string, machineId: string, prType: string) {
  // Get gym_id from session
  const { data: session } = await admin
    .from('workout_sessions')
    .select('gym_id')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  const eventType = prType === 'volume' ? 'pr_volume' : 'pr_weight';
  const displayText = prType === 'first_session'
    ? 'First time on this machine!'
    : `New ${prType} PR!`;

  await admin.from('gym_feed_events').insert({
    gym_id: session.gym_id,
    member_id: memberId,
    event_type: eventType,
    display_text: displayText,
    context_data: { session_id: sessionId, machine_id: machineId, pr_type: prType },
    priority: prType === 'weight' ? 'high' : 'medium',
  });
}
