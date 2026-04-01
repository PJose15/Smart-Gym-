import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET(request: Request) {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status') ?? 'all';
    const status = ['all', 'active', 'trialing', 'past_due', 'cancelled'].includes(statusParam) ? statusParam : 'all';
    const tierParam = searchParams.get('tier') ?? 'all';
    const tier = ['all', 'starter', 'growth', 'pro'].includes(tierParam) ? tierParam : 'all';
    const search = (searchParams.get('search') ?? '').slice(0, 256);
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? 50) || 50), 100);
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    // Get gyms
    let gymsQuery = admin
      .from('gyms')
      .select('id, name, slug, owner_id, subscription_tier, subscription_status, is_active, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      gymsQuery = gymsQuery.ilike('name', `%${search}%`);
    }
    if (status !== 'all') {
      gymsQuery = gymsQuery.eq('subscription_status', status);
    }
    if (tier !== 'all') {
      gymsQuery = gymsQuery.eq('subscription_tier', tier);
    }

    const [gymsRes, memberCountsRes, sessionCountsRes, statusCountsRes] = await Promise.all([
      gymsQuery,
      admin.from('members').select('gym_id').eq('is_active', true),
      admin.from('workout_sessions').select('gym_id').gte('session_date', thirtyDaysAgo),
      admin.from('gyms').select('subscription_status'),
    ]);

    // Count members per gym
    const memberCounts: Record<string, number> = {};
    for (const m of memberCountsRes.data ?? []) {
      memberCounts[m.gym_id] = (memberCounts[m.gym_id] ?? 0) + 1;
    }

    // Count sessions per gym (30d)
    const sessionCounts: Record<string, number> = {};
    for (const s of sessionCountsRes.data ?? []) {
      sessionCounts[s.gym_id] = (sessionCounts[s.gym_id] ?? 0) + 1;
    }

    // Status summary
    const statusSummary: Record<string, number> = { active: 0, trialing: 0, past_due: 0, cancelled: 0 };
    for (const g of statusCountsRes.data ?? []) {
      const st = g.subscription_status ?? 'active';
      statusSummary[st] = (statusSummary[st] ?? 0) + 1;
    }

    // Build gym list with computed fields
    const gyms = (gymsRes.data ?? []).map((g: {
      id: string; name: string; slug: string; owner_id: string;
      subscription_tier: string; subscription_status: string; is_active: boolean; created_at: string;
    }) => {
      const members = memberCounts[g.id] ?? 0;
      const sessions = sessionCounts[g.id] ?? 0;

      // Health score: activity (sessions/members ratio capped at 3x) + billing status
      let health = 50;
      if (members > 0) health += Math.min(30, Math.round(Math.min(sessions / members, 3) * 10));
      if (g.subscription_status === 'active') health += 20;
      else if (g.subscription_status === 'trialing') health += 10;
      health = Math.min(100, Math.max(0, health));

      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        owner_id: g.owner_id,
        tier: g.subscription_tier,
        status: g.subscription_status,
        members,
        sessions_30d: sessions,
        health_score: health,
      };
    });

    return NextResponse.json({
      gyms,
      summary: statusSummary,
    });
  } catch (err) {
    console.error('[/api/admin/gyms] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
