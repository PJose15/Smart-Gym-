'use client';

import { useEffect, useState, CSSProperties } from 'react';
import type { BillingInfo, SubscriptionTier } from '@nexera/types';

const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: 'var(--color-green)', bg: 'var(--color-green-light)' },
  trialing: { color: 'var(--color-blue)', bg: 'var(--color-blue-subtle)' },
  past_due: { color: 'var(--color-gold)', bg: 'rgba(255, 215, 0,0.15)' },
  cancelled: { color: 'var(--color-red)', bg: 'var(--color-red-light)' },
  incomplete: { color: 'var(--color-gold)', bg: 'rgba(255, 215, 0,0.15)' },
  unpaid: { color: 'var(--color-red)', bg: 'var(--color-red-light)' },
  paused: { color: 'var(--color-text-muted)', bg: 'var(--color-bg-elevated)' },
};

const defaultStatus = { color: 'var(--color-text-muted)', bg: 'var(--color-bg-elevated)' };

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBilling();
  }, []);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing/status');
      if (!res.ok) throw new Error('Failed to load billing info');
      const data = await res.json();
      setBilling(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setError(null);
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        setError(data.error || 'Failed to open billing portal');
        return;
      }
      if (data.portal_url) {
        window.location.href = data.portal_url;
      } else {
        setError('Failed to open billing portal');
      }
    } catch {
      setError('Failed to open billing portal');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpgrade(tier: SubscriptionTier) {
    setError(null);
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval: 'monthly' }),
      });
      const data = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        setError(data.error || 'Failed to start checkout');
        return;
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError('Failed to start checkout');
      }
    } catch {
      setError('Failed to start checkout');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div style={pageStyle}><p style={{ color: 'var(--color-text-muted)' }}>Loading billing info...</p></div>;
  }

  if (error && !billing) {
    return <div style={pageStyle}><p style={{ color: 'var(--color-red-light)' }}>{error}</p></div>;
  }

  if (!billing) return null;

  const trialDaysLeft = billing.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const machineUsagePct = billing.limits.max_machines > 0
    ? Math.round((billing.counts.machines / billing.limits.max_machines) * 100)
    : 0;
  const memberUsagePct = billing.limits.max_members > 0
    ? Math.round((billing.counts.members / billing.limits.max_members) * 100)
    : 0;

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>Billing</h1>

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

      {/* Current Plan */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={cardTitleStyle}>Current Plan</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span style={tierBadgeStyle}>{TIER_LABELS[billing.tier]}</span>
              <span style={{
                ...statusBadgeStyle,
                backgroundColor: (STATUS_COLORS[billing.status] || defaultStatus).bg,
                color: (STATUS_COLORS[billing.status] || defaultStatus).color,
              }}>
                {billing.status}
              </span>
            </div>
          </div>
          {billing.stripe_customer_id && (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              style={secondaryButtonStyle}
            >
              {actionLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
        </div>

        {billing.status === 'trialing' && trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div style={trialBannerStyle}>
            <strong>{trialDaysLeft}</strong> day{trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial
            {billing.trial_ends_at && (
              <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                (ends {new Date(billing.trial_ends_at).toLocaleDateString()})
              </span>
            )}
          </div>
        )}

        {billing.current_period_end && billing.status === 'active' && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: '8px 0 0' }}>
            Current period ends {new Date(billing.current_period_end).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Usage */}
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}>Usage</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <UsageBar
            label="Machines"
            count={billing.counts.machines}
            limit={billing.limits.max_machines}
            pct={machineUsagePct}
          />
          <UsageBar
            label="Members"
            count={billing.counts.members}
            limit={billing.limits.max_members}
            pct={memberUsagePct}
          />
        </div>
      </div>

      {/* Upgrade options */}
      {billing.tier !== 'pro' && (
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Upgrade Your Plan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {billing.tier === 'starter' && (
              <PlanCard
                name="Growth"
                price="$99/mo"
                features={['Up to 50 machines', 'Up to 500 members', 'AI programs', 'Coach notes', 'Challenges', 'Heatmap']}
                onSelect={() => handleUpgrade('growth')}
                loading={actionLoading}
              />
            )}
            <PlanCard
              name="Pro"
              price="$199/mo"
              features={['Unlimited machines', 'Unlimited members', 'All Growth features', 'Franchise support', 'All AI agents']}
              onSelect={() => handleUpgrade('pro')}
              loading={actionLoading}
              highlighted
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UsageBar({ label, count, limit, pct }: { label: string; count: number; limit: number; pct: number }) {
  const isUnlimited = limit === -1;
  const barColor = pct >= 90 ? 'var(--color-red-light)' : pct >= 70 ? 'var(--color-gold-light)' : 'var(--color-blue)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          {count} / {isUnlimited ? 'Unlimited' : limit}
        </span>
      </div>
      <div style={barTrackStyle}>
        <div style={{
          ...barFillStyle,
          width: isUnlimited ? '5%' : `${Math.min(pct, 100)}%`,
          backgroundColor: barColor,
        }} />
      </div>
    </div>
  );
}

function PlanCard({ name, price, features, onSelect, loading, highlighted }: {
  name: string;
  price: string;
  features: string[];
  onSelect: () => void;
  loading: boolean;
  highlighted?: boolean;
}) {
  return (
    <div style={{
      ...planCardStyle,
      borderColor: highlighted ? 'var(--color-blue)' : 'var(--color-border-subtle)',
    }}>
      <h3 style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 4px' }}>{name}</h3>
      <p style={{ color: 'var(--color-blue)', fontSize: 'var(--text-xl)', fontWeight: 600, margin: '0 0 16px' }}>{price}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
        {features.map((f) => (
          <li key={f} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: '3px 0' }}>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={loading}
        style={highlighted ? primaryButtonStyle : secondaryButtonStyle}
      >
        {loading ? 'Loading...' : `Upgrade to ${name}`}
      </button>
    </div>
  );
}

// --- Styles ---------------------------------------------------------

const pageStyle: CSSProperties = {
  maxWidth: 800,
};

const headingStyle: CSSProperties = {
  fontSize: 'var(--text-xl)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  marginBottom: 24,
};

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  marginBottom: 20,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  margin: 0,
};

const tierBadgeStyle: CSSProperties = {
  backgroundColor: 'var(--color-blue-subtle)',
  color: 'var(--color-blue)',
  padding: '4px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
};

const statusBadgeStyle: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  textTransform: 'capitalize' as const,
};

const trialBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-blue-subtle)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 16px',
  color: 'var(--color-blue-light)',
  fontSize: 'var(--text-sm)',
  marginTop: 16,
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--color-red-subtle)',
  border: '1px solid var(--color-red)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 16px',
  color: 'var(--color-red-light)',
  fontSize: 'var(--text-sm)',
  marginBottom: 16,
};

const barTrackStyle: CSSProperties = {
  height: 8,
  backgroundColor: 'var(--color-bg-base)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
};

const barFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 'var(--radius-sm)',
  transition: 'width 0.3s ease',
};

const planCardStyle: CSSProperties = {
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: 'var(--color-blue)',
  color: 'var(--color-text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '10px 20px',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: 'transparent',
  color: 'var(--color-blue)',
  border: '1px solid var(--color-blue)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 20px',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};
