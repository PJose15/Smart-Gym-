import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/billing/stripeClient';
import { handleStripeWebhook } from '@/lib/billing/stripeHelpers';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { resolveOwnerProfileId, sendNotification } from '@/lib/notifications/dispatcher';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not set');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[billing/webhook] Signature verification failed:', err instanceof Error ? err.message : 'Unknown error');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const result = await handleStripeWebhook(event);

    // Fire UptimizeAI agents for billing events (fire-and-forget — never block webhook response)
    if (result.gymId) {
      const gymId = result.gymId;
      switch (result.action) {
        case 'subscription_cancelled':
          triggerUptimizeAIAgent('retention-agent', {
            event: 'subscription-cancelled',
            gym_id: gymId,
          }).catch(err => console.error('[webhook] retention-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));
          // Owner push — fire-and-forget (never block webhook response)
          ;(async () => {
            try {
              const admin = getAdminClient();
              const ownerProfileId = await resolveOwnerProfileId(admin, gymId);
              if (ownerProfileId) {
                await sendNotification({
                  gym_id: gymId,
                  profile_id: ownerProfileId,
                  type: 'subscription_cancelled',
                  title: 'Subscription cancelled',
                  body: 'Your subscription was cancelled. You can resubscribe anytime.',
                });
              }
            } catch (err) {
              console.error('[webhook] subscription_cancelled push failed:', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
          break;
        case 'payment_failed':
          triggerUptimizeAIAgent('revenue-agent', {
            event: 'payment-failed',
            gym_id: gymId,
          }).catch(err => console.error('[webhook] revenue-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));
          // Owner push — fire-and-forget
          ;(async () => {
            try {
              const admin = getAdminClient();
              const ownerProfileId = await resolveOwnerProfileId(admin, gymId);
              if (ownerProfileId) {
                await sendNotification({
                  gym_id: gymId,
                  profile_id: ownerProfileId,
                  type: 'payment_failed',
                  title: 'Payment failed',
                  body: 'Your latest payment failed. Update your billing details.',
                });
              }
            } catch (err) {
              console.error('[webhook] payment_failed push failed:', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
          break;
        case 'trial_ending':
          triggerUptimizeAIAgent('engagement-agent', {
            event: 'trial-ending-soon',
            gym_id: gymId,
          }).catch(err => console.error('[webhook] engagement-agent trigger failed:', err instanceof Error ? err.message : 'Unknown error'));
          // Owner push — fire-and-forget
          ;(async () => {
            try {
              const admin = getAdminClient();
              const ownerProfileId = await resolveOwnerProfileId(admin, gymId);
              if (ownerProfileId) {
                await sendNotification({
                  gym_id: gymId,
                  profile_id: ownerProfileId,
                  type: 'trial_ending',
                  title: 'Trial ending soon',
                  body: 'Your Nexera trial ends in 3 days. Choose a plan to keep your gym live.',
                });
              }
            } catch (err) {
              console.error('[webhook] trial_ending push failed:', err instanceof Error ? err.message : 'Unknown error');
            }
          })();
          break;
      }
    }

    return NextResponse.json({ received: true, action: result.action });
  } catch (err) {
    console.error('[billing/webhook] Error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
