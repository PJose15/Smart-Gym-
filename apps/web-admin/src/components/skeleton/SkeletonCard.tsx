'use client';

interface SkeletonCardProps {
  height?: string;
  children?: React.ReactNode;
}

export function SkeletonCard({ height = '120px', children }: SkeletonCardProps) {
  return (
    <div
      className="skeleton"
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
