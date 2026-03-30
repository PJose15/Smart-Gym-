'use client';

import { SkeletonLine, SkeletonCard, SkeletonCircle } from '@/components/skeleton';

export function HomeScreenSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px' }}>
      {/* Hero skeleton */}
      <SkeletonCard height="180px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonCircle size="44px" />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="60%" height="14px" />
            <div style={{ marginTop: 6 }}>
              <SkeletonLine width="40%" height="10px" />
            </div>
          </div>
        </div>
        <SkeletonLine width="80%" height="20px" />
        <SkeletonLine width="90%" height="12px" />
        <SkeletonLine width="100%" height="4px" />
      </SkeletonCard>

      {/* Today zone skeleton */}
      <SkeletonCard height="100px">
        <SkeletonLine width="30%" height="10px" />
        <SkeletonLine width="70%" height="14px" />
        <SkeletonLine width="100%" height="6px" />
      </SkeletonCard>

      {/* Momentum tiles skeleton */}
      <div style={{ display: 'flex', gap: 8 }}>
        <SkeletonCard height="80px" />
        <SkeletonCard height="80px" />
        <SkeletonCard height="80px" />
      </div>

      {/* Stats row skeleton */}
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} height="56px" />
        ))}
      </div>

      {/* Feed skeleton */}
      <SkeletonCard height="120px">
        <SkeletonLine width="25%" height="10px" />
        <SkeletonLine width="90%" height="12px" />
        <SkeletonLine width="85%" height="12px" />
      </SkeletonCard>
    </div>
  );
}
