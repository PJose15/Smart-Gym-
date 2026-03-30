'use client';

interface SkeletonCircleProps {
  size?: string;
}

export function SkeletonCircle({ size = '48px' }: SkeletonCircleProps) {
  return (
    <div
      className="skeleton"
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}
