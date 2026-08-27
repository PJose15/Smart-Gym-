import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateUUIDs } from '@/lib/validation/uuid';
import type { ReadinessResult, ReadinessZone } from '@nexera/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const uuidError = validateUUIDs({ memberId: params.memberId });
    if (uuidError) return uuidError;
    const rl = checkRateLimit(`readiness-log:${params.memberId}`, 5, 60_000);
    if (rl) return rl;

    const auth = await verifyMember(params.memberId);
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const body = await req.json();
    const { sleep, soreness, mood, stress, energy } = body;

    // Validate 1-10 range
    const rawInputs: Record<string, unknown> = {
      sleep,
      soreness,
      mood,
      stress,
      energy,
    };
    for (const [key, val] of Object.entries(rawInputs)) {
      if (typeof val !== 'number' || val < 1 || val > 10) {
        return NextResponse.json(
          { error: `${key} must be 1-10` },
          { status: 400 }
        );
      }
    }

    // gym_id is required (NOT NULL) on member_readiness_cache.
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', params.memberId)
      .maybeSingle();
    if (memberErr || !member?.gym_id) {
      return NextResponse.json(
        { error: 'Failed to resolve member gym' },
        { status: 500 }
      );
    }

    // Calculate readiness score (0-100)
    // Weights: sleep 30%, soreness (inverted) 20%, mood 15%, stress (inverted) 20%, energy 15%
    const score = Math.round(
      sleep * 3 +
        (11 - soreness) * 2 +
        mood * 1.5 +
        (11 - stress) * 2 +
        energy * 1.5
    );
    // Map to the real zone enum: 'peak' | 'ready' | 'moderate' | 'rest'.
    const zone: ReadinessZone =
      score >= 85 ? 'peak' : score >= 70 ? 'ready' : score >= 50 ? 'moderate' : 'rest';

    const ZONE_COPY: Record<ReadinessZone, { color: string; headline: string; subline: string }> = {
      peak: { color: '#00C896', headline: 'Peak readiness', subline: 'Your body is primed to train hard.' },
      ready: { color: '#E0142F', headline: 'Ready to train', subline: 'You are in good shape for a solid session.' },
      moderate: { color: '#FFB020', headline: 'Train with care', subline: 'Consider a moderate session today.' },
      rest: { color: '#FF7A90', headline: 'Rest recommended', subline: 'Your body could use recovery time.' },
    };

    // Determine the dominant self-reported signal (largest deviation from neutral 5.5).
    const contributions: Record<string, number> = {
      sleep,
      recovery: 11 - soreness,
      mood,
      stress: 11 - stress,
      energy,
    };
    const dominant_signal = Object.entries(contributions).reduce(
      (best, [k, v]) => (Math.abs(v - 5.5) > Math.abs(best.v - 5.5) ? { k, v } : best),
      { k: 'sleep', v: contributions.sleep }
    ).k;

    // Build a ReadinessResult-shaped payload so the page + history reader
    // (which read the real `score`/`zone`/`result_json`) stay consistent.
    const result: ReadinessResult = {
      score,
      zone,
      color: ZONE_COPY[zone].color,
      headline: ZONE_COPY[zone].headline,
      subline: ZONE_COPY[zone].subline,
      dominant_signal,
      signals: {
        session_count: 0,
        rpe: 0,
        rest_days: 0,
        streak: 0,
        volume_trend: 0,
      },
    };

    // Upsert today's readiness against the real columns.
    const today = new Date().toISOString().split('T')[0];
    const { error } = await admin.from('member_readiness_cache').upsert(
      {
        member_id: params.memberId,
        gym_id: member.gym_id,
        cache_date: today,
        score,
        zone,
        result_json: JSON.stringify(result),
        inputs_json: JSON.stringify({ sleep, soreness, mood, stress, energy, source: 'self_report' }),
        dominant_signal,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,cache_date' }
    );

    if (error)
      return NextResponse.json(
        { error: 'Failed to log readiness' },
        { status: 500 }
      );
    return NextResponse.json({ score, zone, date: today });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
