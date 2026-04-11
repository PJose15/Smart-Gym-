import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { createPortalSession } from '@/lib/billing/stripeHelpers';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id, user_id } = result;

    const rl = checkRateLimit(`billing-portal:${user_id}`, 10, 300_000);
    if (rl) return rl;

    const { data: billing } = await admin
      .from('gym_billing')
      .select('stripe_customer_id')
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await createPortalSession(
      billing.stripe_customer_id,
      `${appUrl}/owner/billing`
    );

    return NextResponse.json({ portal_url: session.url });
  } catch (err) {
    console.error('[billing/portal] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
