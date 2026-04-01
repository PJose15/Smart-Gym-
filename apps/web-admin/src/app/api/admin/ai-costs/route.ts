import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;

    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [todayMetricRes, trendRes, mrrRes] = await Promise.all([
      admin
        .from('platform_daily_metrics')
        .select('openai_cost_usd, ai_tips_generated, ai_programs_generated')
        .eq('date', today)
        .maybeSingle(),
      admin
        .from('platform_daily_metrics')
        .select('date, openai_cost_usd, ai_tips_generated, ai_programs_generated')
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false }),
      admin
        .from('platform_daily_metrics')
        .select('mrr_usd')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const todayData = todayMetricRes.data;
    const trendData = trendRes.data ?? [];

    const todayCost = todayData ? Number(todayData.openai_cost_usd) : 0;
    const monthTotal = trendData.reduce(
      (sum: number, m: { openai_cost_usd: number }) => sum + Number(m.openai_cost_usd),
      0
    );

    // Budget: 2% of daily revenue (MRR / 30 * 0.02)
    const mrr = mrrRes.data ? Number(mrrRes.data.mrr_usd) : 0;
    const dailyBudget = Math.round(((mrr / 30) * 0.02) * 100) / 100;

    return NextResponse.json({
      today_cost: Math.round(todayCost * 100) / 100,
      daily_budget: dailyBudget,
      month_total: Math.round(monthTotal * 100) / 100,
      ai_tips_today: todayData ? Number(todayData.ai_tips_generated) : 0,
      ai_programs_today: todayData ? Number(todayData.ai_programs_generated) : 0,
      trend: trendData.map((m: {
        date: string;
        openai_cost_usd: number;
        ai_tips_generated: number;
        ai_programs_generated: number;
      }) => ({
        date: m.date,
        cost: Number(m.openai_cost_usd),
        tips: Number(m.ai_tips_generated),
        programs: Number(m.ai_programs_generated),
      })),
    });
  } catch (err) {
    console.error('[/api/admin/ai-costs] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
