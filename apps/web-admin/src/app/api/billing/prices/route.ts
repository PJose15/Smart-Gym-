import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripeClient';
import { getPriceId } from '@/lib/billing/stripeHelpers';
import { checkRateLimit } from '@/lib/rateLimit';
import { getPricesCache, setPricesCache } from './cache';
import type { SubscriptionTier, BillingInterval } from '@nexera/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PriceEntry {
  unit_amount: number | null;
  currency: string;
}

interface TierPrices {
  monthly: PriceEntry | null;
  annual: PriceEntry | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const TIERS: SubscriptionTier[] = ['starter', 'growth', 'pro'];
const INTERVALS: BillingInterval[] = ['monthly', 'annual'];

async function fetchPricesFromStripe(): Promise<{ prices: Record<SubscriptionTier, TierPrices> }> {
  const stripe = getStripe();

  const results: Record<string, TierPrices> = {};

  for (const tier of TIERS) {
    results[tier] = { monthly: null, annual: null };
    for (const interval of INTERVALS) {
      try {
        const priceId = getPriceId(tier, interval);
        const price = await stripe.prices.retrieve(priceId);
        results[tier][interval] = {
          unit_amount: price.unit_amount,
          currency: price.currency,
        };
      } catch {
        // Missing env var or Stripe error — keep null so page renders "—"
        results[tier][interval] = null;
      }
    }
  }

  return { prices: results as Record<SubscriptionTier, TierPrices> };
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // Light session check — read-only harmless data, don't use verifyStaff
    const supabase = await createServerSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit per IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`billing-prices:${ip}`, 30, 60_000);
    if (rl) return rl;

    // Serve from cache if fresh
    const now = Date.now();
    const cached = getPricesCache();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Fetch fresh prices from Stripe
    const data = await fetchPricesFromStripe();
    setPricesCache({ data, fetchedAt: now });

    return NextResponse.json(data);
  } catch (err) {
    console.error('[billing/prices] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
