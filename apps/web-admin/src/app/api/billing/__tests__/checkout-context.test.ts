/**
 * @jest-environment node
 *
 * Tests for:
 * - checkout route context-aware URLs (onboarding vs default)
 * - billing/prices endpoint (live prices + cache)
 */

// ─── Checkout route mocks ─────────────────────────────────────────────────────

const mockCreateCheckoutSession = jest.fn();
const mockCreateStripeCustomer = jest.fn();

jest.mock('@/lib/billing/stripeHelpers', () => ({
  createStripeCustomer: jest.fn().mockImplementation(function (...args) {
    return mockCreateStripeCustomer(...args);
  }),
  createCheckoutSession: jest.fn().mockImplementation(function (...args) {
    return mockCreateCheckoutSession(...args);
  }),
  getPriceId: jest.fn().mockImplementation(function (tier, interval) {
    return 'price_' + tier + '_' + interval;
  }),
}));

const mockRateLimit = jest.fn();
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockImplementation(function (...args) {
    return mockRateLimit(...args);
  }),
}));

// ─── Prices route mocks ───────────────────────────────────────────────────────

const mockPricesRetrieve = jest.fn();

jest.mock('@/lib/billing/stripeClient', () => ({
  getStripe: jest.fn().mockReturnValue({
    prices: {
      retrieve: jest.fn().mockImplementation(function (...args) {
        return mockPricesRetrieve(...args);
      }),
    },
  }),
}));

// ─── Supabase server mock (session check for prices route) ───────────────────

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockImplementation(function () {
    return Promise.resolve({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
        }),
      },
    });
  }),
}));

// ─── verifyStaff mock ─────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/auth/verifyStaff', () => ({
  verifyStaff: jest.fn().mockImplementation(function () {
    return Promise.resolve({
      user_id: 'user-123',
      gym_id: 'gym-abc',
      role: 'owner',
      permissions: {},
      admin: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: function (...args: any[]) {
          return mockFrom(...args);
        },
      },
    });
  }),
}));

// ─── Checkout route tests ─────────────────────────────────────────────────────

describe('POST /api/billing/checkout - context-aware URLs', () => {
  beforeEach(() => {
    mockRateLimit.mockReturnValue(null);
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_abc',
    });

    const billingChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(billingChain);

    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nexera.io';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Test 1: context=onboarding passes success+cancel URLs to createCheckoutSession', async () => {
    const { POST } = await import('../checkout/route');

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'starter', interval: 'monthly', context: 'onboarding' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'gym-abc',
      'cus_existing',
      'starter',
      'monthly',
      {
        successUrl:
          'https://app.nexera.io/setup?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://app.nexera.io/subscribe?cancelled=true',
      }
    );
  });

  test('Test 2: no context calls createCheckoutSession with undefined urls', async () => {
    const { POST } = await import('../checkout/route');

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'growth', interval: 'annual' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'gym-abc',
      'cus_existing',
      'growth',
      'annual',
      undefined
    );
  });

  test('Test 3: invalid context value rejected with 400', async () => {
    const { POST } = await import('../checkout/route');

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'starter', interval: 'monthly', context: 'bad-value' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });
});

// ─── Prices route tests ───────────────────────────────────────────────────────

describe('GET /api/billing/prices', () => {
  beforeEach(async () => {
    // Reset mock implementation
    mockPricesRetrieve.mockImplementation(function (priceId) {
      return Promise.resolve({ id: priceId, unit_amount: 2900, currency: 'usd' });
    });

    // Reset module-level cache so each test starts fresh
    const { _resetPricesCache } = await import('../prices/route');
    _resetPricesCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Re-set the mock implementation after clearAllMocks
    mockPricesRetrieve.mockImplementation(function (priceId) {
      return Promise.resolve({ id: priceId, unit_amount: 2900, currency: 'usd' });
    });
  });

  test('Test 4a: GET returns prices with unit_amount+currency for all 6 combos', async () => {
    const { GET } = await import('../prices/route');

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.prices).toBeDefined();
    expect(body.prices.starter.monthly).toBeDefined();
    expect(body.prices.starter.monthly.unit_amount).toBe(2900);
    expect(body.prices.starter.monthly.currency).toBe('usd');
    expect(body.prices.starter.annual).toBeDefined();
    expect(body.prices.growth.monthly).toBeDefined();
    expect(body.prices.growth.annual).toBeDefined();
    expect(body.prices.pro.monthly).toBeDefined();
    expect(body.prices.pro.annual).toBeDefined();
  });

  test('Test 4b: second call within TTL does not re-hit Stripe (module-level cache)', async () => {
    const { GET } = await import('../prices/route');

    // First call — cache was reset in beforeEach so Stripe is hit 6 times
    await GET();
    const callsAfterFirst = mockPricesRetrieve.mock.calls.length;
    expect(callsAfterFirst).toBe(6);

    // Second call within TTL — must NOT re-hit Stripe
    await GET();
    expect(mockPricesRetrieve.mock.calls.length).toBe(6);
  });
});
