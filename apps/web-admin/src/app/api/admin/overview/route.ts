import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import type { PlatformOverviewData } from '@nexera/types';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;

    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [gymsRes, membersRes, sessionsRes, metricsRes, newRegsRes] = await Promise.all([
      admin.from('gyms').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('workout_sessions').select('id', { count: 'exact', head: true }).gte('session_date', today),
      admin.from('platform_daily_metrics').select('*').gte('date', thirtyDaysAgo).order('date', { ascending: false }),
      admin.from('members').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo).eq('status', 'active'),
    ]);

    if (gymsRes.error || membersRes.error || sessionsRes.error || metricsRes.error || newRegsRes.error) {
      console.error('[/api/admin/overview] Query errors:', {
        gyms: gymsRes.error, members: membersRes.error, sessions: sessionsRes.error,
        metrics: metricsRes.error, newRegs: newRegsRes.error,
      });
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const metrics = metricsRes.data ?? [];
    const latestMetric = metrics[0];

    const openaiCost30d = metrics.reduce(
      (sum: number, m: { openai_cost_usd: number }) => sum + Number(m.openai_cost_usd),
      0
    );

    const overview: PlatformOverviewData = {
      active_gyms: gymsRes.count ?? 0,
      total_members: membersRes.count ?? 0,
      sessions_today: sessionsRes.count ?? 0,
      mrr_usd: latestMetric ? Number(latestMetric.mrr_usd) : 0,
      openai_cost_30d: Math.round(openaiCost30d * 100) / 100,
      new_registrations_7d: newRegsRes.count ?? 0,
      health_status: 'healthy',
    };

    return NextResponse.json(overview);
  } catch (err) {
    console.error('[/api/admin/overview] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
