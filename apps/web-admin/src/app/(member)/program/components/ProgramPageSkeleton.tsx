'use client';

import { SkeletonLine, SkeletonCard } from '@/components/skeleton';

export function ProgramPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <SkeletonLine width="40%" height="20px" />
      <SkeletonCard height="140px" />
      <SkeletonCard height="80px" />
      <SkeletonCard height="80px" />
      <SkeletonCard height="80px" />
    </div>
  );
}
