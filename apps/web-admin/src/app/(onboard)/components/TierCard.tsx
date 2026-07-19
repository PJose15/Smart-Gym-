'use client';

import type { CSSProperties } from 'react';

// ─── Types ────────────────────────────────────────────────

export interface PriceEntry {
  unit_amount: number | null;
  currency: string;
}

export type TierName = 'starter' | 'growth' | 'pro';

interface TierCardProps {
  tier: TierName;
  name: string;
  blurb: string;
  features: string[];
  price: PriceEntry | null;
  interval: 'monthly' | 'annual';
  highlighted?: boolean;
  onSelect: () => void;
  disabled?: boolean;
  pending?: boolean;
}

// ─── Styles ───────────────────────────────────────────────

const baseCardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 12,
  padding: '20px 20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
  position: 'relative',
};

const highlightedCardStyle: CSSProperties = {
  ...baseCardStyle,
  border: '2px solid var(--accent)',
};

const pillStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  borderRadius: 99,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  alignSelf: 'flex-start',
  marginBottom: 4,
};

const tierNameStyle: CSSProperties = {
  fontSize: '1.0625rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
};

const blurbStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-text-secondary)',
  margin: '2px 0 0',
  lineHeight: 1.5,
};

const priceStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  letterSpacing: '-0.02em',
};

const priceSubStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-text-muted)',
  fontWeight: 400,
};

const featureListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const featureItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: '0.8125rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.4,
};

const buttonStyle: CSSProperties = {
  width: '100%',
  padding: '10px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 4,
  letterSpacing: '-0.01em',
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const outlineButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'transparent',
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
};

// ─── Check icon ────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <circle cx="7" cy="7" r="7" fill="var(--accent-subtle)" />
      <path
        d="M4.5 7l1.8 1.8L9.5 5.5"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatPrice(price: PriceEntry | null, interval: 'monthly' | 'annual'): string {
  if (!price || price.unit_amount == null) return '—';
  const perMonth = interval === 'annual' ? price.unit_amount / 12 / 100 : price.unit_amount / 100;
  return `$${perMonth % 1 === 0 ? perMonth.toFixed(0) : perMonth.toFixed(0)}/mo`;
}

// ─── Component ─────────────────────────────────────────────

export function TierCard({
  tier,
  name,
  blurb,
  features,
  price,
  interval,
  highlighted = false,
  onSelect,
  disabled = false,
  pending = false,
}: TierCardProps) {
  const cardStyle = highlighted ? highlightedCardStyle : baseCardStyle;
  const btnDisabled = disabled || pending;
  const btnStyle = btnDisabled
    ? disabledButtonStyle
    : highlighted
    ? buttonStyle
    : outlineButtonStyle;

  return (
    <div style={cardStyle} data-tier={tier}>
      {highlighted && <span style={pillStyle}>Most popular</span>}

      <div>
        <h3 style={tierNameStyle}>{name}</h3>
        <p style={blurbStyle}>{blurb}</p>
      </div>

      <div>
        <span style={priceStyle}>{formatPrice(price, interval)}</span>
        {interval === 'annual' && price && price.unit_amount != null && (
          <span style={priceSubStyle}> (billed annually)</span>
        )}
        {price && price.unit_amount != null && interval === 'monthly' && (
          <span style={priceSubStyle}> / month</span>
        )}
      </div>

      <ul style={featureListStyle} aria-label={`${name} features`}>
        {features.map((feature) => (
          <li key={feature} style={featureItemStyle}>
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={btnDisabled}
        style={btnStyle}
        aria-label={`Select ${name} plan`}
        aria-busy={pending}
      >
        {pending ? 'Redirecting...' : `Choose ${name}`}
      </button>
    </div>
  );
}
