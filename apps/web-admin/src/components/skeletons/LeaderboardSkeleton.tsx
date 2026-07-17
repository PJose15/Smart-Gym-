'use client';

import { Skeleton } from './Skeleton';

/**
 * Leaderboard loading state — DOC_03 §14: rank rows with position + name.
 */
export function LeaderboardSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading leaderboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* Podium hint */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, padding: '16px 0', marginBottom: 8 }}>
        <Skeleton width={85} height={100} radius={12} />
        <Skeleton width={100} height={120} radius={12} />
        <Skeleton width={85} height={85} radius={12} />
      </div>

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: '10px var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <Skeleton width={24} height={24} circle />
          <Skeleton width="45%" height={13} />
          <div style={{ flex: 1 }} />
          <Skeleton width={48} height={13} />
        </div>
      ))}
    </div>
  );
}
