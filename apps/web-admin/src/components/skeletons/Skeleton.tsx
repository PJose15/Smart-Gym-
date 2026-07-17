'use client';

import { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** border radius — defaults to --radius-sm; pass '50%' (or circle) for circles */
  radius?: string | number;
  /** shorthand for a circle of `size` px */
  circle?: boolean;
  style?: CSSProperties;
}

/**
 * Base skeleton block — DOC_03 Section 14.
 * Shimmer (base #1F1F26 → shine #252530, 1.5s linear, left-to-right) comes
 * from the single shared `.skeleton` CSS animation in animations.css —
 * never define per-instance animations.
 */
export function Skeleton({ width = '100%', height = 16, radius, circle = false, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : radius ?? 'var(--radius-sm)',
        flexShrink: circle ? 0 : undefined,
        ...style,
      }}
    />
  );
}
