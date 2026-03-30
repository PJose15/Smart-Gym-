'use client';

import { CSSProperties } from 'react';

interface SkeletonGateProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

const wrapperStyle: CSSProperties = {
  position: 'relative',
};

const fadeStyle = (visible: boolean): CSSProperties => ({
  opacity: visible ? 1 : 0,
  transition: 'opacity 0.2s ease-in-out',
  ...(visible ? {} : { position: 'absolute', inset: 0, pointerEvents: 'none' }),
});

export function SkeletonGate({ loading, skeleton, children }: SkeletonGateProps) {
  return (
    <div style={wrapperStyle}>
      <div style={fadeStyle(loading)}>{skeleton}</div>
      <div style={fadeStyle(!loading)}>{children}</div>
    </div>
  );
}
