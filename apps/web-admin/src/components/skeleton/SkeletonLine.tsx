'use client';

interface SkeletonLineProps {
  width?: string;
  height?: string;
}

export function SkeletonLine({ width = '100%', height = '16px' }: SkeletonLineProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 'var(--radius-sm)' }}
      aria-hidden="true"
    />
  );
}
