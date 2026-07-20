/**
 * @jest-environment node
 *
 * Tests for billing webhook owner push notifications (06-07 Task 1)
 *
 * Covers the three billing events that trigger owner pushes:
 *  - trial_ending  → sendNotification with type 'trial_ending'
 *  - payment_failed → sendNotification with type 'payment_failed'
 *  - subscription_cancelled → sendNotification with type 'subscription_cancelled'
 *  - resolveOwnerProfileId returning null → no dispatch, no throw, webhook still 200
 *  - Existing triggerUptimizeAIAgent calls still fire for all three actions
 */

import { NextRequest } from 'next/server';

// ─── Mock stripe ──────────────────────────────────────────
const mockConstructEvent = jest.fn();
jest.mock('@/lib/billing/stripeClient', () => ({
  getStripe: jest.fn().mockReturnValue({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

// ─── Mock handleStripeWebhook ─────────────────────────────
const mockHandleStripeWebhook = jest.fn();
jest.mock('@/lib/billing/stripeHelpers', () => ({
  handleStripeWebhook: (...args: unknown[]) => mockHandleStripeWebhook(...args),
}));

// ─── Mock triggerUptimizeAIAgent ──────────────────────────
const mockTriggerAgent = jest.fn();
jest.mock('@/lib/billing/triggerAgent', () => ({
  triggerUptimizeAIAgent: (...args: unknown[]) => mockTriggerAgent(...args),
}));

// ─── Mock dispatcher (resolveOwnerProfileId + sendNotification) ───────────────
const mockResolveOwnerProfileId = jest.fn();
const mockSendNotification = jest.fn();
jest.mock('@/lib/notifications/dispatcher', () => ({
  resolveOwnerProfileId: (...args: unknown[]) => mockResolveOwnerProfileId(...args),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// ─── Mock Supabase (admin client used for resolveOwnerProfileId lookup) ───────
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

// ─── Helpers ──────────────────────────────────────────────
function makeWebhookRequest(body = '{}') {
  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test-sig',
    },
    body,
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

  // Default: constructEvent succeeds
  mockConstructEvent.mockReturnValue({ type: 'customer.subscription.updated', data: {} });

  // Default: handleStripeWebhook returns no action (no gym)
  mockHandleStripeWebhook.mockResolvedValue({ gymId: null, action: 'ignored' });

  // Default: triggerAgent resolves
  mockTriggerAgent.mockResolvedValue({ success: true });

  // Default: owner found
  mockResolveOwnerProfileId.mockResolvedValue('owner-profile-uuid');

  // Default: sendNotification succeeds
  mockSendNotification.mockResolvedValue('sent');
});

// ─── trial_ending ─────────────────────────────────────────
describe('billing webhook — trial_ending owner push', () => {
  test('trial_ending → sendNotification called with type trial_ending and owner profile_id', async () => {
    const GYM_ID = 'gym-trial';
    mockHandleStripeWebhook.mockResolvedValue({ gymId: GYM_ID, action: 'trial_ending' });
    mockResolveOwnerProfileId.mockResolvedValue('owner-trial');

    const req = makeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for fire-and-forget to settle (microtask flush)
    await new Promise(r => setTimeout(r, 50));

    expect(mockResolveOwnerProfileId).toHaveBeenCalledWith(expect.anything(), GYM_ID);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        gym_id: GYM_ID,
        profile_id: 'owner-trial',
        type: 'trial_ending',
      })
    );
  });

  test('trial_ending — triggerUptimizeAIAgent still fires alongside the push', async () => {
    mockHandleStripeWebhook.mockResolvedValue({ gymId: 'gym-x', action: 'trial_ending' });

    const req = makeWebhookRequest();
    await POST(req);
    await new Promise(r => setTimeout(r, 50));

    expect(mockTriggerAgent).toHaveBeenCalledWith(
      'engagement-agent',
      expect.objectContaining({ event: 'trial-ending-soon' })
    );
  });
});

// ─── payment_failed ───────────────────────────────────────
describe('billing webhook — payment_failed owner push', () => {
  test('payment_failed → sendNotification called with type payment_failed', async () => {
    const GYM_ID = 'gym-pay';
    mockHandleStripeWebhook.mockResolvedValue({ gymId: GYM_ID, action: 'payment_failed' });
    mockResolveOwnerProfileId.mockResolvedValue('owner-pay');

    const req = makeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        gym_id: GYM_ID,
        profile_id: 'owner-pay',
        type: 'payment_failed',
      })
    );
  });

  test('payment_failed — triggerUptimizeAIAgent still fires', async () => {
    mockHandleStripeWebhook.mockResolvedValue({ gymId: 'gym-y', action: 'payment_failed' });

    const req = makeWebhookRequest();
    await POST(req);
    await new Promise(r => setTimeout(r, 50));

    expect(mockTriggerAgent).toHaveBeenCalledWith(
      'revenue-agent',
      expect.objectContaining({ event: 'payment-failed' })
    );
  });
});

// ─── subscription_cancelled ───────────────────────────────
describe('billing webhook — subscription_cancelled owner push', () => {
  test('subscription_cancelled → sendNotification called with type subscription_cancelled', async () => {
    const GYM_ID = 'gym-cancel';
    mockHandleStripeWebhook.mockResolvedValue({ gymId: GYM_ID, action: 'subscription_cancelled' });
    mockResolveOwnerProfileId.mockResolvedValue('owner-cancel');

    const req = makeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        gym_id: GYM_ID,
        profile_id: 'owner-cancel',
        type: 'subscription_cancelled',
      })
    );
  });

  test('subscription_cancelled — triggerUptimizeAIAgent still fires', async () => {
    mockHandleStripeWebhook.mockResolvedValue({ gymId: 'gym-z', action: 'subscription_cancelled' });

    const req = makeWebhookRequest();
    await POST(req);
    await new Promise(r => setTimeout(r, 50));

    expect(mockTriggerAgent).toHaveBeenCalledWith(
      'retention-agent',
      expect.objectContaining({ event: 'subscription-cancelled' })
    );
  });
});

// ─── resolveOwnerProfileId null → no dispatch, still 200 ─
describe('billing webhook — null owner profile resilience', () => {
  test('resolveOwnerProfileId returning null → no sendNotification call, webhook still 200', async () => {
    mockHandleStripeWebhook.mockResolvedValue({ gymId: 'gym-noowner', action: 'trial_ending' });
    mockResolveOwnerProfileId.mockResolvedValue(null);

    const req = makeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test('sendNotification throwing → webhook still returns 200 (fire-and-forget resilience)', async () => {
    mockHandleStripeWebhook.mockResolvedValue({ gymId: 'gym-err', action: 'payment_failed' });
    mockResolveOwnerProfileId.mockResolvedValue('owner-err');
    mockSendNotification.mockRejectedValue(new Error('Push service down'));

    const req = makeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 50));
    // No throw — webhook response unaffected
  });
});
