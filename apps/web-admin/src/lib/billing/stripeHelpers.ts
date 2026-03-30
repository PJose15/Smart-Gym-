import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { SubscriptionTier, BillingInterval } from '@nexera/types';
import { getStripe } from './stripeClient';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createStripeCustomer(
  email: string,
  name: string,
  gymId: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email,
    name,
    metadata: { gym_id: gymId },
  });
}

export function getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
  const map: Record<string, string | undefined> = {
    'starter_monthly': process.env.STRIPE_PRICE_STARTER_MONTHLY,
    'starter_annual': process.env.STRIPE_PRICE_STARTER_ANNUAL,
    'growth_monthly': process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    'growth_annual': process.env.STRIPE_PRICE_GROWTH_ANNUAL,
    'pro_monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'pro_annual': process.env.STRIPE_PRICE_PRO_ANNUAL,
  };
  const key = `${tier}_${interval}`;
  const priceId = map[key];
  if (!priceId) throw new Error(`No Stripe price ID configured for ${key}`);
  return priceId;
}

export async function createCheckoutSession(
  gymId: string,
  customerId: string,
  tier: SubscriptionTier,
  interval: BillingInterval
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const priceId = getPriceId(tier, interval);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: { gym_id: gymId, tier },
    },
    success_url: `${appUrl}/owner/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${appUrl}/owner/billing?cancelled=true`,
    metadata: { gym_id: gymId, tier },
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<{ action: string; gymId?: string }> {
  const admin = getAdminClient();

  switch (event.type) {
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const gymId = sub.metadata.gym_id;
      if (!gymId) return { action: 'no_gym_id' };

      const tier = (sub.metadata.tier || 'starter') as SubscriptionTier;
      const status = mapStripeStatus(sub.status);
      const firstItem = sub.items.data[0];
      const recurringInterval = firstItem?.price?.recurring?.interval;
      const billingInterval = recurringInterval === 'year' ? 'annual' : 'monthly';

      await admin
        .from('gym_billing')
        .update({
          stripe_subscription_id: sub.id,
          stripe_price_id: firstItem?.price?.id ?? null,
          tier,
          billing_interval: billingInterval,
          subscription_status: status,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end: firstItem?.current_period_end
            ? new Date(firstItem.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('gym_id', gymId);

      // Sync tier to gyms table
      await admin
        .from('gyms')
        .update({
          subscription_tier: tier,
          subscription_status: mapGymStatus(status),
        })
        .eq('id', gymId);

      return { action: 'subscription_updated', gymId };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const gymId = sub.metadata.gym_id;
      if (!gymId) return { action: 'no_gym_id' };

      await admin
        .from('gym_billing')
        .update({
          subscription_status: 'cancelled',
        })
        .eq('gym_id', gymId);

      await admin
        .from('gyms')
        .update({
          subscription_status: 'cancelled',
        })
        .eq('id', gymId);

      return { action: 'subscription_cancelled', gymId };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const subId = subDetails
        ? (typeof subDetails.subscription === 'string'
            ? subDetails.subscription
            : subDetails.subscription?.id)
        : null;
      if (!subId) return { action: 'no_subscription' };

      const { data: billing } = await admin
        .from('gym_billing')
        .select('gym_id')
        .eq('stripe_subscription_id', subId)
        .single();

      if (billing) {
        await admin
          .from('gym_billing')
          .update({ subscription_status: 'past_due' })
          .eq('gym_id', billing.gym_id);

        await admin
          .from('gyms')
          .update({ subscription_status: 'past_due' })
          .eq('id', billing.gym_id);

        return { action: 'payment_failed', gymId: billing.gym_id };
      }
      return { action: 'payment_failed_no_billing' };
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const gymId = sub.metadata.gym_id;
      return { action: 'trial_ending', gymId: gymId || undefined };
    }

    default:
      return { action: 'unhandled', gymId: undefined };
  }
}

/** Maps Stripe subscription status to gym_billing status */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const map: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'unpaid',
    paused: 'paused',
  };
  return map[stripeStatus] || 'active';
}

/** Maps gym_billing status to gyms.subscription_status (different CHECK constraint) */
function mapGymStatus(billingStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    trialing: 'trial',
    past_due: 'past_due',
    cancelled: 'cancelled',
    incomplete: 'payment_required',
    incomplete_expired: 'cancelled',
    unpaid: 'past_due',
    paused: 'cancelled',
  };
  return map[billingStatus] || 'active';
}
