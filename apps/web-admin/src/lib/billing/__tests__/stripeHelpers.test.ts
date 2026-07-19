import type Stripe from 'stripe';

// ─── Mock @supabase/supabase-js ───────────────────────────────────────────────
// Babel hoists jest.mock() calls — only variables prefixed "mock" (case-insensitive)
// can be referenced inside the factory.
// We expose a mutable object whose .value is read at call time by the mock.
const mockInsertState = {
  value: { data: [{ event_id: 'evt_001' }] as { event_id: string }[] | null, error: null as { code: string } | null },
};
const mockFromCalls: string[] = [];

jest.mock('@supabase/supabase-js', () => {
  const makeEq = (result: unknown) => ({ eq: jest.fn().mockResolvedValue(result) });
  const makeEqSingle = () => ({
    eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null }) }),
  });

  return {
    createClient: jest.fn().mockImplementation(() => ({
      from: (table: string) => {
        mockFromCalls.push(table);

        if (table === 'stripe_events_processed') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockImplementation(() => Promise.resolve(mockInsertState.value)),
            }),
          };
        }
        if (table === 'gym_billing') {
          return {
            update: jest.fn().mockReturnValue(makeEq({ error: null })),
            select: jest.fn().mockReturnValue(makeEqSingle()),
          };
        }
        if (table === 'gyms') {
          return {
            update: jest.fn().mockReturnValue(makeEq({ error: null })),
          };
        }
        return {};
      },
    })),
  };
});

// ─── Mock ./stripeClient ──────────────────────────────────────────────────────
const mockSessionsCreate = jest.fn();
jest.mock('../stripeClient', () => ({
  getStripe: jest.fn().mockReturnValue({
    checkout: {
      sessions: { create: (...args: unknown[]) => mockSessionsCreate(...args) },
    },
  }),
}));

// Import AFTER mocks are set up
import { handleStripeWebhook, createCheckoutSession } from '../stripeHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeEvent(
  type: string,
  data: Record<string, unknown>,
  id = 'evt_001'
): Stripe.Event {
  return {
    id,
    type,
    data: { object: data },
  } as unknown as Stripe.Event;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1: Idempotency guard + checkout.session.completed/expired handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('handleStripeWebhook — idempotency guard', () => {
  beforeEach(() => {
    mockFromCalls.length = 0;
  });

  it('T1: second call returns { action: "duplicate" } when insert returns empty array (unique-violation)', async () => {
    mockInsertState.value = { data: [], error: null };

    const event = makeEvent(
      'customer.subscription.updated',
      { id: 'sub_001', metadata: { gym_id: 'gym-1', tier: 'starter' }, status: 'trialing', items: { data: [] } }
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'duplicate' });
  });

  it('T1b: duplicate also fires when insert returns null data (constraint error)', async () => {
    mockInsertState.value = { data: null, error: { code: '23505' } };

    const event = makeEvent(
      'customer.subscription.updated',
      { id: 'sub_001', metadata: { gym_id: 'gym-1', tier: 'starter' }, status: 'trialing', items: { data: [] } }
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'duplicate' });
  });

  it('T6: fresh event with customer.subscription.updated still returns { action: "subscription_updated" }', async () => {
    mockInsertState.value = { data: [{ event_id: 'evt_fresh' }], error: null };

    const event = makeEvent(
      'customer.subscription.updated',
      {
        id: 'sub_fresh',
        metadata: { gym_id: 'gym-2', tier: 'growth' },
        status: 'trialing',
        trial_end: null,
        items: {
          data: [
            {
              price: { id: 'price_123', recurring: { interval: 'month' } },
              current_period_end: null,
            },
          ],
        },
      },
      'evt_fresh'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'subscription_updated', gymId: 'gym-2' });
  });
});

describe('handleStripeWebhook — checkout.session.completed', () => {
  beforeEach(() => {
    mockFromCalls.length = 0;
    mockInsertState.value = { data: [{ event_id: 'evt_checkout' }], error: null };
  });

  it('T2: string subscription — returns checkout_completed with gymId', async () => {
    const event = makeEvent(
      'checkout.session.completed',
      {
        metadata: { gym_id: 'gym-10' },
        subscription: 'sub_abc123',
      },
      'evt_checkout'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'checkout_completed', gymId: 'gym-10' });
  });

  it('T3: object-form subscription — extracts .id correctly', async () => {
    mockInsertState.value = { data: [{ event_id: 'evt_checkout2' }], error: null };
    const event = makeEvent(
      'checkout.session.completed',
      {
        metadata: { gym_id: 'gym-11' },
        subscription: { id: 'sub_obj456' },
      },
      'evt_checkout2'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'checkout_completed', gymId: 'gym-11' });
  });

  it('T4: missing metadata.gym_id returns { action: "no_gym_id" }, no DB writes to gym_billing or gyms', async () => {
    mockInsertState.value = { data: [{ event_id: 'evt_no_gymid' }], error: null };
    const event = makeEvent(
      'checkout.session.completed',
      {
        metadata: {},
        subscription: 'sub_orphan',
      },
      'evt_no_gymid'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'no_gym_id' });

    // Verify no gym_billing or gyms tables were touched
    expect(mockFromCalls).not.toContain('gym_billing');
    expect(mockFromCalls).not.toContain('gyms');
  });
});

describe('handleStripeWebhook — checkout.session.expired', () => {
  beforeEach(() => {
    mockFromCalls.length = 0;
    mockInsertState.value = { data: [{ event_id: 'evt_expired' }], error: null };
  });

  it('T5: sets gym_billing to "trialing" (retryable), returns checkout_expired', async () => {
    const event = makeEvent(
      'checkout.session.expired',
      {
        metadata: { gym_id: 'gym-20' },
      },
      'evt_expired'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'checkout_expired', gymId: 'gym-20' });
  });

  it('T5b: missing gym_id returns { action: "no_gym_id" }', async () => {
    mockInsertState.value = { data: [{ event_id: 'evt_expired_no_gym' }], error: null };
    const event = makeEvent(
      'checkout.session.expired',
      { metadata: {} },
      'evt_expired_no_gym'
    );

    const result = await handleStripeWebhook(event);
    expect(result).toEqual({ action: 'no_gym_id' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Hardened createCheckoutSession
// ─────────────────────────────────────────────────────────────────────────────

describe('createCheckoutSession', () => {
  beforeEach(() => {
    mockSessionsCreate.mockResolvedValue({ id: 'cs_test_001', url: 'https://checkout.stripe.com/test' });
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter_monthly';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nexera.io';
  });

  afterEach(() => {
    mockSessionsCreate.mockReset();
    mockSessionsCreate.mockResolvedValue({ id: 'cs_test_001', url: 'https://checkout.stripe.com/test' });
  });

  it('T1: includes payment_method_collection: "always"', async () => {
    await createCheckoutSession('gym-1', 'cus_001', 'starter', 'monthly');
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.payment_method_collection).toBe('always');
  });

  it('T2: subscription_data.trial_settings.end_behavior.missing_payment_method === "cancel"', async () => {
    await createCheckoutSession('gym-1', 'cus_001', 'starter', 'monthly');
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(
      args.subscription_data?.trial_settings?.end_behavior?.missing_payment_method
    ).toBe('cancel');
  });

  it('T3: default success_url and cancel_url point to /owner/billing', async () => {
    await createCheckoutSession('gym-1', 'cus_001', 'starter', 'monthly');
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.success_url).toBe(
      'https://app.nexera.io/owner/billing?session_id={CHECKOUT_SESSION_ID}&success=true'
    );
    expect(args.cancel_url).toBe('https://app.nexera.io/owner/billing?cancelled=true');
  });

  it('T4: when urls argument provided, uses those exact URLs instead', async () => {
    const urls = {
      successUrl: 'https://app.nexera.io/onboarding?step=complete&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://app.nexera.io/onboarding?step=billing&cancelled=true',
    };
    await createCheckoutSession('gym-1', 'cus_001', 'starter', 'monthly', urls);
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.success_url).toBe(urls.successUrl);
    expect(args.cancel_url).toBe(urls.cancelUrl);
  });

  it('T4b: partial override — only successUrl provided, cancelUrl falls back to default', async () => {
    await createCheckoutSession('gym-1', 'cus_001', 'starter', 'monthly', {
      successUrl: 'https://app.nexera.io/onboarding?done=1',
    });
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.success_url).toBe('https://app.nexera.io/onboarding?done=1');
    expect(args.cancel_url).toBe('https://app.nexera.io/owner/billing?cancelled=true');
  });
});
