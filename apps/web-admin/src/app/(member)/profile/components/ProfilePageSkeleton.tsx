'use client';

import { SkeletonLine, SkeletonCard, SkeletonCircle } from '@/components/skeleton';

export function ProfilePageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, alignItems: 'center' }}>
      <SkeletonCircle size="80px" />
      <SkeletonLine width="40%" height="18px" />
      <SkeletonLine width="25%" height="12px" />
      <SkeletonCard height="60px" />
      <SkeletonCard height="60px" />
      <SkeletonCard height="60px" />
    </div>
  );
}
