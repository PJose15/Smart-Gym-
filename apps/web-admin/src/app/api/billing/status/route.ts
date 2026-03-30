import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { SUBSCRIPTION_TIERS } from '@/lib/billing/tiers';
import type { SubscriptionTier, BillingInfo } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    const [billingRes, machineCountRes, memberCountRes] = await Promise.all([
      admin
        .from('gym_billing')
        .select('tier, subscription_status, billing_interval, trial_ends_at, current_period_end, stripe_customer_id')
        .eq('gym_id', gym_id)
        .maybeSingle(),
      admin
        .from('machines')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gym_id),
      admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gym_id),
    ]);

    const billing = billingRes.data;
    const tier = (billing?.tier || 'starter') as SubscriptionTier;
    const tierDef = SUBSCRIPTION_TIERS[tier];

    const info: BillingInfo = {
      tier,
      status: billing?.subscription_status || 'trialing',
      billing_interval: billing?.billing_interval || 'monthly',
      trial_ends_at: billing?.trial_ends_at || null,
      current_period_end: billing?.current_period_end || null,
      stripe_customer_id: billing?.stripe_customer_id || null,
      limits: {
        max_machines: tierDef.features.max_machines,
        max_members: tierDef.features.max_members,
      },
      counts: {
        machines: machineCountRes.count ?? 0,
        members: memberCountRes.count ?? 0,
      },
    };

    return NextResponse.json(info);
  } catch (err) {
    console.error('[billing/status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
