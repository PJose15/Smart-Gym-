import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/verifySuperAdmin';
import { SUBSCRIPTION_TIERS } from '@/lib/billing/tiers';
import type { SubscriptionTier } from '@nexera/types';

export async function GET() {
  const result = await verifySuperAdmin();
  if (result instanceof NextResponse) return result;

  try {
    const { admin } = result;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString();

    // All gym_billing reads are capped to bound platform-wide growth.
    // 5000 gyms is an order of magnitude beyond expected MVP scale.
    // platform_daily_metrics is naturally bounded by the 30-day filter
    // but we cap at 100 rows for defence in depth.
    const [billingRes, metricsRes, pastDueRes, trialEndingRes] = await Promise.all([
      admin
        .from('gym_billing')
        .select('gym_id, tier, subscription_status, trial_ends_at')
        .limit(5000),
      admin
        .from('platform_daily_metrics')
        .select('date, mrr_usd')
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false })
        .limit(100),
      admin
        .from('gym_billing')
        .select('gym_id, tier')
        .eq('subscription_status', 'past_due')
        .limit(5000),
      admin
        .from('gym_billing')
        .select('gym_id, tier, trial_ends_at')
        .eq('subscription_status', 'trialing')
        .lte('trial_ends_at', threeDaysFromNow)
        .limit(5000),
    ]);

    const billingData = billingRes.data ?? [];

    // Count by tier and status
    const byTier: Record<string, { count: number; active: number }> = {
      starter: { count: 0, active: 0 },
      growth: { count: 0, active: 0 },
      pro: { count: 0, active: 0 },
    };
    const byStatus: Record<string, number> = {};
    let trialsThisMonth = 0;

    for (const row of billingData) {
      const tier = row.tier ?? 'starter';
      if (byTier[tier]) byTier[tier].count += 1;

      const validStatuses = ['active', 'trialing', 'past_due', 'cancelled'];
      const st = validStatuses.includes(row.subscription_status) ? row.subscription_status : 'unknown';
      byStatus[st] = (byStatus[st] ?? 0) + 1;

      if (st === 'active' || st === 'trialing') {
        if (byTier[tier]) byTier[tier].active += 1;
      }

      if (st === 'trialing') trialsThisMonth += 1;
    }

    // Calculate MRR from active subscriptions
    let mrr = 0;
    for (const [tier, data] of Object.entries(byTier)) {
      const price = SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.price_monthly ?? 0;
      mrr += data.active * price;
    }

    const arr = mrr * 12;
    const totalActive = Object.values(byTier).reduce((s, t) => s + t.active, 0);
    const arpu = totalActive > 0 ? Math.round(mrr / totalActive) : 0;

    // Revenue by plan
    const revenueByPlan = Object.entries(byTier).map(([tier, data]) => ({
      tier,
      name: SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.name ?? tier,
      count: data.active,
      mrr: data.active * (SUBSCRIPTION_TIERS[tier as SubscriptionTier]?.price_monthly ?? 0),
    }));

    // MRR trend from platform_daily_metrics
    const metrics = metricsRes.data ?? [];
    const lastMonthMrr = metrics.length > 0
      ? Number(metrics[metrics.length - 1]?.mrr_usd ?? 0)
      : 0;

    return NextResponse.json({
      mrr,
      arr,
      arpu,
      trials_this_month: trialsThisMonth,
      past_due_count: pastDueRes.data?.length ?? 0,
      revenue_by_plan: revenueByPlan,
      by_status: byStatus,
      mrr_trend: metrics.map((m: { date: string; mrr_usd: number }) => ({
        date: m.date,
        mrr: Number(m.mrr_usd),
      })),
      last_month_mrr: lastMonthMrr,
      at_risk: [
        ...(pastDueRes.data ?? []).map((r: { gym_id: string; tier: string }) => ({
          gym_id: r.gym_id,
          tier: r.tier,
          reason: 'past_due',
        })),
        ...(trialEndingRes.data ?? []).map((r: { gym_id: string; tier: string; trial_ends_at: string }) => ({
          gym_id: r.gym_id,
          tier: r.tier,
          reason: 'trial_ending',
          trial_ends_at: r.trial_ends_at,
        })),
      ],
    });
  } catch (err) {
    console.error('[/api/admin/billing] Error:', err);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
