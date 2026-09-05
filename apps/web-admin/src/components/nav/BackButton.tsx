'use client';

import { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  /** Where to go when there is no in-app history (PWA cold start / deep link). */
  fallbackHref?: string;
  /** Optional extra styles merged over the base button style. */
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 4px',
  marginLeft: -4,
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-full, 9999px)',
  color: 'var(--color-text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

/**
 * Back-navigation affordance for stacked member sub-pages. The member PWA
 * runs standalone (no browser chrome), so pages pushed on top of a tab need
 * an explicit way back. Uses history when available, else the fallback route.
 */
export function BackButton({ fallbackHref = '/home', style }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go back"
      style={{ ...baseStyle, ...style }}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}
