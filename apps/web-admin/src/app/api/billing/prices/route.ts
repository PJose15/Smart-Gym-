import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripeClient';
import { getPriceId } from '@/lib/billing/stripeHelpers';
import { checkRateLimit } from '@/lib/rateLimit';
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

interface PricesCache {
  data: { prices: Record<SubscriptionTier, TierPrices> };
  fetchedAt: number;
}

// ─── Module-level cache (1 hour TTL) ───────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let pricesCache: PricesCache | null = null;

const TIERS: SubscriptionTier[] = ['starter', 'growth', 'pro'];
const INTERVALS: BillingInterval[] = ['monthly', 'annual'];

async function fetchPricesFromStripe(): Promise<PricesCache['data']> {
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

export async function GET(request?: Request) {
  try {
    // Light session check — read-only harmless data, don't use verifyStaff
    const supabase = await createServerSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit per IP
    const ip =
      (request instanceof Request
        ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        : undefined) ?? 'unknown';
    const rl = checkRateLimit(`billing-prices:${ip}`, 30, 60_000);
    if (rl) return rl;

    // Serve from cache if fresh
    const now = Date.now();
    if (pricesCache && now - pricesCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(pricesCache.data);
    }

    // Fetch fresh prices from Stripe
    const data = await fetchPricesFromStripe();
    pricesCache = { data, fetchedAt: now };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[billing/prices] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Exported for testing — allows resetting the module-level cache */
export function _resetPricesCache() {
  pricesCache = null;
}
