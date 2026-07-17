'use client';

import { Skeleton } from './Skeleton';

/**
 * Feed loading state — DOC_03 §14: 5 event cards, avatar + text lines.
 */
export function FeedSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading feed"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 'var(--card-padding)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'flex-start',
          }}
        >
          <Skeleton width={36} height={36} circle />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="45%" height={12} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="30%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
