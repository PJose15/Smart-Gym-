import { NextRequest, NextResponse } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import { verifyMember } from '@/lib/auth/verifyMember';
import { z } from 'zod';
import { uuidString } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';
import { formatVolume, formatWeight } from '@/lib/weight';

const prCheckSchema = z.object({
  session_id: uuidString,
  member_id: uuidString,
  machine_id: uuidString,
  weight_lbs: z.number().min(0).max(2000),
  reps: z.number().int().min(1).max(100),
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

    const { session_id, member_id, machine_id, weight_lbs } = parsed.data;

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
      .select('id, best_weight_lbs, total_volume_lbs')
      .eq('id', session_id)
      .eq('member_id', member_id)
      .eq('machine_id', machine_id)
      .maybeSingle();
    if (!ownedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // The session's server-computed best is the ceiling of what was actually
    // logged via /api/sessions — clamp the body weight to it so a caller
    // can't record a PR heavier than any set they logged.
    const effectiveWeight = Math.min(weight_lbs, ownedSession.best_weight_lbs || 0);

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
      await markPR(admin, session_id, member_id, 'first_session', effectiveWeight, null);
      await insertFeedEvent(admin, session_id, member_id, machine_id, {
        prType: 'first_session',
        value: effectiveWeight,
        previousValue: null,
        improvementPct: null,
      });

      return NextResponse.json({
        pr: {
          type: 'first_session',
          value: effectiveWeight,
          previousValue: null,
          improvementPct: null,
        },
      });
    }

    // Check weight PR
    const historicalBestWeight = Math.max(
      ...history.map((h) => h.best_weight_lbs || 0)
    );

    if (effectiveWeight > historicalBestWeight && historicalBestWeight > 0) {
      const improvementPct =
        Math.round(((effectiveWeight - historicalBestWeight) / historicalBestWeight) * 1000) / 10;

      await markPR(admin, session_id, member_id, 'weight', effectiveWeight, historicalBestWeight);
      await insertFeedEvent(admin, session_id, member_id, machine_id, {
        prType: 'weight',
        value: effectiveWeight,
        previousValue: historicalBestWeight,
        improvementPct,
      });

      return NextResponse.json({
        pr: {
          type: 'weight',
          value: effectiveWeight,
          previousValue: historicalBestWeight,
          improvementPct,
        },
      });
    }

    // Check volume PR — server-stored session total only (no body-derived
    // fallback: a zero/absent stored volume means no volume PR).
    const historicalBestVolume = Math.max(
      ...history.map((h) => h.total_volume_lbs || 0)
    );

    const currentTotalVolume = ownedSession.total_volume_lbs || 0;

    if (currentTotalVolume > historicalBestVolume && historicalBestVolume > 0) {
      const improvementPct =
        Math.round(((currentTotalVolume - historicalBestVolume) / historicalBestVolume) * 1000) / 10;

      await markPR(admin, session_id, member_id, 'volume', currentTotalVolume, historicalBestVolume);
      await insertFeedEvent(admin, session_id, member_id, machine_id, {
        prType: 'volume',
        value: currentTotalVolume,
        previousValue: historicalBestVolume,
        improvementPct,
      });

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

interface PRFeedInfo {
  prType: 'first_session' | 'weight' | 'volume';
  /** Best weight (lbs) for weight/first_session PRs; session volume (lbs) for volume PRs. */
  value: number;
  previousValue: number | null;
  improvementPct: number | null;
}

/** Coerce an unknown context value into a finite number, or null. */
function ctxNumber(ctx: Record<string, unknown>, key: string): number | null {
  const v = ctx[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * PR feed events (pr_weight / pr_volume) are OWNED by this route — it is the
 * single producer. `lib/feedGenerator.ts` intentionally does not create PR
 * events (it used to, and its daily dedupe was shadowed by the rows written
 * here).
 *
 * `context_data` carries everything `formatFeedEvent` (web) /
 * `formatFeedEventText` (mobile) need to rebuild the description in the
 * viewer's weight unit: best_weight_lbs / volume_lbs, machine_name, pr_type,
 * previous_best_lbs, improvement_pct. `display_text` is the lbs-baked
 * fallback and never includes the member name (the UI renders the bold
 * name span separately).
 *
 * Dedupe: max ONE PR feed event per member per UTC day. A better PR later
 * the same day upgrades the existing event in place; a weight PR replaces a
 * same-day volume PR (weight outranks volume, mirroring detection order).
 */
async function insertFeedEvent(
  admin: SupabaseClient,
  sessionId: string,
  memberId: string,
  machineId: string,
  info: PRFeedInfo
) {
  // Get gym_id from session
  const { data: session } = await admin
    .from('workout_sessions')
    .select('gym_id')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  const { data: machine } = await admin
    .from('machines')
    .select('name')
    .eq('id', machineId)
    .maybeSingle();
  const machineName: string | null = machine?.name ?? null;
  const onPart = machineName ? ` on ${machineName}` : '';

  const eventType = info.prType === 'volume' ? 'pr_volume' : 'pr_weight';
  const contextData: Record<string, unknown> = {
    session_id: sessionId,
    machine_id: machineId,
    machine_name: machineName,
    pr_type: info.prType,
    previous_best_lbs: info.previousValue,
    improvement_pct: info.improvementPct,
  };

  let displayText: string;
  if (info.prType === 'volume') {
    contextData.volume_lbs = info.value;
    displayText = `hit a volume PR${onPart} — ${formatVolume(info.value, 'lbs')}!`;
  } else if (info.prType === 'weight') {
    contextData.best_weight_lbs = info.value;
    displayText = `hit a new personal best${onPart} — ${formatWeight(info.value, 'lbs')}!`;
  } else {
    // first_session carries no unit-bearing number in the text, so clients
    // pass display_text through unchanged (no context weight to rebuild).
    displayText = machineName
      ? `logged a first session on ${machineName}!`
      : 'logged a first session on a new machine!';
  }

  const priority = info.prType === 'weight' ? 'high' : 'medium';

  // Daily dedupe / in-place upgrade
  const today = new Date().toISOString().split('T')[0];
  const { data: existingRows } = await admin
    .from('gym_feed_events')
    .select('id, event_type, context_data')
    .eq('member_id', memberId)
    .in('event_type', ['pr_weight', 'pr_volume'])
    .gte('created_at', `${today}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] as
    | { id: string; event_type: string; context_data: Record<string, unknown> | null }
    | undefined;

  if (existing) {
    // first_session never upgrades an existing PR event.
    if (info.prType === 'first_session') return;

    const existingCtx = existing.context_data ?? {};
    const existingValue =
      eventType === 'pr_weight'
        ? ctxNumber(existingCtx, 'best_weight_lbs')
        : ctxNumber(existingCtx, 'volume_lbs');

    const weightOverVolume =
      eventType === 'pr_weight' && existing.event_type === 'pr_volume';
    const sameTypeImproved =
      existing.event_type === eventType &&
      (existingValue == null || info.value > existingValue);

    if (!weightOverVolume && !sameTypeImproved) return;

    await admin
      .from('gym_feed_events')
      .update({
        event_type: eventType,
        display_text: displayText,
        context_data: contextData,
        priority,
      })
      .eq('id', existing.id);
    return;
  }

  await admin.from('gym_feed_events').insert({
    gym_id: session.gym_id,
    member_id: memberId,
    event_type: eventType,
    display_text: displayText,
    context_data: contextData,
    priority,
  });
}
