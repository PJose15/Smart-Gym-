import { NextResponse, NextRequest } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

export const dynamic = 'force-dynamic';

/** GET /api/gym/[gymId]/dna/stats — Aggregate DNA stats for owner dashboard */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const { gymId } = await params;
    const uuidError = validateUUIDs({ gymId });
    if (uuidError) return uuidError;

    const authResult = await verifyStaff();
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.gym_id !== gymId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = authResult.admin;

    const { data: caches } = await admin
      .from('member_dna_cache')
      .select(
        'power_score, consistency_score, progression_score, balance_score, mindset_score, archetype_id, is_building'
      )
      .eq('gym_id', gymId)
      .eq('is_building', false);

    const entries = caches ?? [];
    if (entries.length === 0) {
      return NextResponse.json({
        avg_scores: { power: 0, consistency: 0, progression: 0, balance: 0, mindset: 0 },
        archetype_distribution: {},
        top_archetype: null,
        member_count: 0,
      });
    }

    const avg = {
      power: Math.round(entries.reduce((s, e) => s + e.power_score, 0) / entries.length),
      consistency: Math.round(entries.reduce((s, e) => s + e.consistency_score, 0) / entries.length),
      progression: Math.round(entries.reduce((s, e) => s + e.progression_score, 0) / entries.length),
      balance: Math.round(entries.reduce((s, e) => s + e.balance_score, 0) / entries.length),
      mindset: Math.round(entries.reduce((s, e) => s + e.mindset_score, 0) / entries.length),
    };

    const distribution: Record<string, number> = {};
    for (const entry of entries) {
      distribution[entry.archetype_id] = (distribution[entry.archetype_id] ?? 0) + 1;
    }

    const topArchetype = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return NextResponse.json({
      avg_scores: avg,
      archetype_distribution: distribution,
      top_archetype: topArchetype,
      member_count: entries.length,
    });
  } catch (err) {
    console.error('[gym/dna/stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
