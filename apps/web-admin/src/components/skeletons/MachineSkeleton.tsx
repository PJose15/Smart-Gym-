'use client';

import { Skeleton } from './Skeleton';

/**
 * Machine page `/m/[slug]` loading state — DOC_03 §14.
 * Mirrors MachineLanding: gym mark, machine image, name, muscle pills, CTA.
 */
export function MachineSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading machine"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-padding-x)',
        paddingTop: 'var(--space-10)',
        paddingBottom: 'var(--space-8)',
      }}
    >
      {/* Gym branding */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 'var(--space-8)' }}>
        <Skeleton width={48} height={48} radius="var(--radius-md)" />
        <Skeleton width={90} height={10} />
      </div>

      {/* Machine image area */}
      <Skeleton width="100%" height="auto" radius="var(--radius-lg)" style={{ aspectRatio: '16/10', marginBottom: 'var(--space-6)' }} />

      {/* Machine name */}
      <Skeleton width="65%" height={26} style={{ marginBottom: 'var(--space-3)' }} />

      {/* Muscle pills */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        <Skeleton width={72} height={26} radius="var(--radius-full)" />
        <Skeleton width={88} height={26} radius="var(--radius-full)" />
        <Skeleton width={64} height={26} radius="var(--radius-full)" />
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA button */}
      <Skeleton width="100%" height={56} radius="var(--radius-lg)" />
    </div>
  );
}
