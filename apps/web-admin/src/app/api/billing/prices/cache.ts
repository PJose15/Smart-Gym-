import type { SubscriptionTier, BillingInterval } from '@nexera/types';

interface PriceEntry {
  unit_amount: number | null;
  currency: string;
}

interface TierPrices {
  monthly: PriceEntry | null;
  annual: PriceEntry | null;
}

export interface PricesCache {
  data: { prices: Record<SubscriptionTier, TierPrices> };
  fetchedAt: number;
}

let pricesCache: PricesCache | null = null;

export function getPricesCache(): PricesCache | null {
  return pricesCache;
}

export function setPricesCache(cache: PricesCache): void {
  pricesCache = cache;
}

/** Exported for testing — allows resetting the module-level cache */
export function _resetPricesCache(): void {
  pricesCache = null;
}
