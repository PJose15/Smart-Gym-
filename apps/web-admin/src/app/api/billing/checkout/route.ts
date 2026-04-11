import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { checkoutSchema } from '@/lib/validation/staff';
import { createStripeCustomer, createCheckoutSession } from '@/lib/billing/stripeHelpers';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id, user_id } = result;

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tier, interval } = parsed.data;

    const rl = checkRateLimit(`billing-checkout:${user_id}`, 5, 300_000);
    if (rl) return rl;

    // Get or create stripe customer
    const { data: billing } = await admin
      .from('gym_billing')
      .select('stripe_customer_id')
      .eq('gym_id', gym_id)
      .maybeSingle();

    let customerId = billing?.stripe_customer_id;

    if (!customerId) {
      // Get owner email from users table and gym name
      const [userRes, gymRes] = await Promise.all([
        admin.from('users').select('email, display_name').eq('id', user_id).single(),
        admin.from('gyms').select('name').eq('id', gym_id).single(),
      ]);

      const customer = await createStripeCustomer(
        userRes.data?.email || '',
        gymRes.data?.name || userRes.data?.display_name || '',
        gym_id
      );
      customerId = customer.id;

      // Upsert billing record with customer ID
      const { error: upsertError } = await admin
        .from('gym_billing')
        .upsert(
          { gym_id, stripe_customer_id: customerId },
          { onConflict: 'gym_id' }
        );

      if (upsertError) {
        console.error('[billing/checkout] Failed to save billing record:', upsertError);
        return NextResponse.json({ error: 'Failed to save billing info' }, { status: 500 });
      }
    }

    const session = await createCheckoutSession(gym_id, customerId, tier, interval);

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    console.error('[billing/checkout] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
