'use client';

import { Skeleton } from './Skeleton';

/**
 * Trainer member list loading state — DOC_03 §14: member rows with status dot.
 */
export function TrainerMemberSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading members"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* Page title + search bar */}
      <Skeleton width={160} height={22} style={{ marginBottom: 'var(--space-3)' }} />
      <Skeleton width="100%" height={44} radius="var(--radius-md)" style={{ marginBottom: 'var(--space-3)' }} />

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Skeleton width={10} height={10} circle />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="40%" height={13} />
            <Skeleton width="25%" height={10} />
          </div>
          <Skeleton width={60} height={12} />
        </div>
      ))}
    </div>
  );
}
