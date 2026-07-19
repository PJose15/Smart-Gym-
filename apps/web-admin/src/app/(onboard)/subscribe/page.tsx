'use client';

import { useEffect, useState, Suspense, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { WizardProgress } from '../components/WizardProgress';
import { TierCard } from '../components/TierCard';
import type { TierName, PriceEntry } from '../components/TierCard';

// ─── Types ────────────��────────────────────────────────────

interface OnboardStatus {
  gym_id: string;
  gym_name: string | null;
  tier: string | null;
  email_confirmed: boolean;
  billing: {
    has_customer: boolean;
    has_subscription: boolean;
    subscription_status: string | null;
  };
}

interface TierPrices {
  monthly: PriceEntry | null;
  annual: PriceEntry | null;
}

interface PricesResponse {
  prices: Record<TierName, TierPrices>;
}

type BillingInterval = 'monthly' | 'annual';

// ─── Tier definitions ──────────────────────────────────────

const TIER_DEFS: {
  tier: TierName;
  name: string;
  blurb: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    tier: 'starter',
    name: 'Starter',
    blurb: 'Everything you need to launch.',
    features: ['Up to 100 members', 'QR machine flow', 'Member app'],
  },
  {
    tier: 'growth',
    name: 'Growth',
    blurb: 'AI tools and automation for growing gyms.',
    features: [
      'Everything in Starter',
      'AI coaching + programs',
      'Challenges & automations',
      'Up to 500 members',
    ],
    highlighted: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    blurb: 'White-label and priority support.',
    features: [
      'Everything in Growth',
      'White-label branding',
      'Priority support',
      'Unlimited members',
    ],
  },
];

// ─── Styles ────────────────────────────────��───────────────

const headingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 4px',
  letterSpacing: '-0.02em',
};

const subStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 20px',
};

const intervalToggleStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 20,
};

const intervalBtnBase: CSSProperties = {
  flex: 1,
  padding: '8px',
  borderRadius: 8,
  border: '1px solid var(--color-border-default)',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)',
};

const intervalBtnActive: CSSProperties = {
  ...intervalBtnBase,
  backgroundColor: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: '#fff',
};

const tierGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--bg-error-subtle)',
  border: '1px solid var(--border-error)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 16,
  fontSize: '0.875rem',
  color: 'var(--color-red)',
};

const resumeBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-amber-subtle, rgba(245, 158, 11, 0.08))',
  border: '1px solid var(--color-amber, #F59E0B)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 20,
  fontSize: '0.875rem',
  color: 'var(--color-text-primary)',
};

const resumeTitleStyle: CSSProperties = {
  fontWeight: 600,
  marginBottom: 2,
};

const sessionExpiredStyle: CSSProperties = {
  textAlign: 'center',
  padding: '40px 24px',
  color: 'var(--color-text-secondary)',
};

const linkStyle: CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
};

const loadingStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  padding: '40px 24px',
};

// ─── Main content ────────��─────────────────────────────────

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<OnboardStatus | null>(null);
  const [prices, setPrices] = useState<PricesResponse['prices'] | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [pendingTier, setPendingTier] = useState<TierName | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const wasCancelled = searchParams.get('cancelled') === 'true';

  // ── On mount: session handshake + status + prices ──────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();

      // Step 1: Exchange PKCE code if present (Pitfall 3)
      const code = searchParams.get('code');
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // Non-fatal — may already be exchanged; continue
        }
        // Strip the code param to avoid re-exchange on refresh
        router.replace('/subscribe');
        return; // useEffect will re-run after navigation
      }

      // Step 2: Force session refresh (Pitfall 3 — membership row was created after JWT)
      await supabase.auth.refreshSession();

      // Step 3: Fetch onboarding status
      const statusRes = await fetch('/api/onboard/status');
      if (cancelled) return;

      if (statusRes.status === 401) {
        setLoadingError('session_expired');
        setInitializing(false);
        return;
      }
      if (statusRes.status === 404) {
        setLoadingError('no_gym');
        setInitializing(false);
        return;
      }
      if (!statusRes.ok) {
        setLoadingError('server_error');
        setInitializing(false);
        return;
      }

      const statusData = (await statusRes.json()) as OnboardStatus;
      if (cancelled) return;

      // Step 4: If already subscribed, skip to setup
      if (statusData.billing.has_subscription) {
        router.replace('/setup');
        return;
      }

      setStatus(statusData);

      // Step 5: Fetch live prices (non-blocking — show cards with "—" if slow)
      try {
        const pricesRes = await fetch('/api/billing/prices');
        if (cancelled) return;
        if (pricesRes.ok) {
          const pricesData = (await pricesRes.json()) as PricesResponse;
          setPrices(pricesData.prices);
        }
      } catch {
        // Non-fatal — prices default to null, cards render "—"
      }

      setInitializing(false);
    }

    init().catch(() => {
      if (!cancelled) {
        setLoadingError('server_error');
        setInitializing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Checkout ───────────────────────────────────────────
  const handleSelectTier = async (tier: TierName) => {
    if (pendingTier) return;
    setCheckoutError(null);
    setPendingTier(tier);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval, context: 'onboarding' }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setCheckoutError(body.error ?? 'Failed to start checkout. Please try again.');
        setPendingTier(null);
        return;
      }

      const { checkout_url } = await res.json() as { checkout_url: string };
      window.location.assign(checkout_url);
      // Don't clear pendingTier — keeps button in loading state during redirect
    } catch {
      setCheckoutError('Network error. Please check your connection and try again.');
      setPendingTier(null);
    }
  };

  // ── Render: loading ────────────────────────────────────
  if (initializing) {
    return (
      <>
        <WizardProgress currentStep={3} />
        <div style={loadingStyle} aria-live="polite" aria-busy="true">
          Loading your plan options...
        </div>
      </>
    );
  }

  // ── Render: session expired ────────────────────────────
  if (loadingError === 'session_expired' || loadingError === 'no_gym') {
    return (
      <>
        <WizardProgress currentStep={3} />
        <div style={sessionExpiredStyle} role="alert">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Session expired</p>
          <p style={{ marginBottom: 16, fontSize: '0.875rem' }}>
            Your session has expired or your gym setup wasn&apos;t completed.
          </p>
          <a href="/signup" style={linkStyle}>
            Start over
          </a>
        </div>
      </>
    );
  }

  if (loadingError === 'server_error') {
    return (
      <>
        <WizardProgress currentStep={3} />
        <div style={errorBannerStyle} role="alert">
          Something went wrong loading your plan options. Please refresh the page.
        </div>
      </>
    );
  }

  // ── Render: tier picker ─────��──────────────────────────
  const showResumeBanner =
    status?.billing.has_customer && !status.billing.has_subscription && wasCancelled;

  const showAbandonedBanner =
    status?.billing.has_customer &&
    !status.billing.has_subscription &&
    !wasCancelled;

  return (
    <>
      <WizardProgress currentStep={3} />

      <h1 style={headingStyle}>Choose your plan</h1>
      <p style={subStyle}>30-day free trial. No charge until your trial ends.</p>

      {/* Resume banner — cancelled checkout or prior abandoned attempt */}
      {(showResumeBanner || showAbandonedBanner) && (
        <div style={resumeBannerStyle} role="status">
          <p style={resumeTitleStyle}>
            {wasCancelled ? 'Checkout cancelled' : 'Your subscription isn&apos;t finished'}
          </p>
          <p style={{ margin: 0 }}>
            Pick a plan below to complete your setup. No new account will be created.
          </p>
        </div>
      )}

      {/* Interval toggle */}
      <div style={intervalToggleStyle} role="group" aria-label="Billing interval">
        <button
          type="button"
          style={interval === 'monthly' ? intervalBtnActive : intervalBtnBase}
          onClick={() => setInterval('monthly')}
          aria-pressed={interval === 'monthly'}
        >
          Monthly
        </button>
        <button
          type="button"
          style={interval === 'annual' ? intervalBtnActive : intervalBtnBase}
          onClick={() => setInterval('annual')}
          aria-pressed={interval === 'annual'}
        >
          Annual
          <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.85 }}>Save ~17%</span>
        </button>
      </div>

      {/* Checkout error */}
      {checkoutError && (
        <div style={errorBannerStyle} role="alert">
          {checkoutError}
        </div>
      )}

      {/* Tier cards */}
      <div style={tierGridStyle}>
        {TIER_DEFS.map(({ tier, name, blurb, features, highlighted }) => (
          <TierCard
            key={tier}
            tier={tier}
            name={name}
            blurb={blurb}
            features={features}
            price={prices?.[tier]?.[interval] ?? null}
            interval={interval}
            highlighted={highlighted}
            onSelect={() => handleSelectTier(tier)}
            disabled={pendingTier !== null && pendingTier !== tier}
            pending={pendingTier === tier}
          />
        ))}
      </div>
    </>
  );
}

// ─── Page export (Suspense wraps useSearchParams) ──────────

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 24px' }}>
          Loading...
        </div>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
