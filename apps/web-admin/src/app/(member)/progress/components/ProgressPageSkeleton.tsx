'use client';

import { SkeletonLine, SkeletonCard } from '@/components/skeleton';

export function ProgressPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <SkeletonLine width="35%" height="20px" />
      <SkeletonCard height="200px" />
      <SkeletonCard height="100px" />
      <SkeletonCard height="100px" />
    </div>
  );
}
