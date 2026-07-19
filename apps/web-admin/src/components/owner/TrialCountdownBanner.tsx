'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';

interface Props {
  daysRemaining: number;
}

const bannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
  backgroundColor: 'color-mix(in srgb, var(--accent) 10%, var(--color-bg-raised))',
  marginBottom: 16,
};

const textStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const upgradeButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  borderRadius: 6,
  backgroundColor: 'var(--accent)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

/**
 * TrialCountdownBanner — slim banner shown while the gym is trialing.
 * Renders "Your trial ends today" when daysRemaining === 0.
 */
export function TrialCountdownBanner({ daysRemaining }: Props) {
  const message =
    daysRemaining === 0
      ? 'Your trial ends today'
      : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your free trial`;

  return (
    <div style={bannerStyle} role="status" aria-live="polite">
      <span style={textStyle}>
        {/* hourglass indicator */}
        <span aria-hidden="true" style={{ marginRight: 6 }}>&#9203;</span>
        {message}
      </span>
      <Link href="/owner/billing" style={upgradeButtonStyle}>
        Upgrade now
      </Link>
    </div>
  );
}
