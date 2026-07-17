'use client';

import { Skeleton } from './Skeleton';

/**
 * Workout logging `/workout/[id]` loading state — DOC_03 §14.
 * Set form area + AI suggestion card.
 */
export function WorkoutSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading workout"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--page-padding-x)', paddingTop: 'var(--space-6)' }}
    >
      {/* Header: machine name + set count */}
      <div>
        <Skeleton width="55%" height={22} style={{ marginBottom: 8 }} />
        <Skeleton width="35%" height={12} />
      </div>

      {/* AI suggestion card */}
      <div
        style={{
          padding: 'var(--card-padding)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <Skeleton width="30%" height={10} />
        <Skeleton width="70%" height={16} />
      </div>

      {/* Set form area — big stepper + input rows */}
      <div
        style={{
          padding: 'var(--card-padding-lg)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <Skeleton width={120} height={48} />
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Skeleton width={64} height={64} circle />
          <Skeleton width={64} height={64} circle />
        </div>
        <Skeleton width="100%" height={52} radius="var(--radius-lg)" />
      </div>

      {/* Previous sets */}
      <Skeleton width="100%" height={44} radius="var(--radius-md)" />
      <Skeleton width="100%" height={44} radius="var(--radius-md)" />
    </div>
  );
}
