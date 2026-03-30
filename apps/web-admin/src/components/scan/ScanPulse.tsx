'use client';

import { useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/ui/haptics';

interface ScanPulseProps {
  /** Ring border color — defaults to gym primary */
  color?: string;
  /** sm = 160px diameter, md = 240px diameter */
  size?: 'sm' | 'md';
  /** Fires after the full 1200ms animation window completes */
  onComplete?: () => void;
}

/**
 * Three concentric sonar rings that expand outward once on mount,
 * then self-destruct from the DOM.
 *
 * Timing:
 *   Ring 1: 0–600ms
 *   Ring 2: 150–750ms
 *   Ring 3: 300–900ms
 *   Unmount: 1200ms (300ms grace after last ring)
 */
export function ScanPulse({
  color = 'var(--gym-primary)',
  size = 'md',
  onComplete,
}: ScanPulseProps) {
  const [visible, setVisible] = useState(true);
  const diameter = size === 'md' ? 240 : 160;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Light haptic tap on mount — fires exactly once
    haptics.light();

    const timer = setTimeout(() => {
      setVisible(false);
      onCompleteRef.current?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="scan-pulse-container"
      aria-hidden="true"
      style={
        {
          '--pulse-color': color,
          '--pulse-size': `${diameter}px`,
        } as React.CSSProperties
      }
    >
      <div className="scan-pulse-ring ring-1" />
      <div className="scan-pulse-ring ring-2" />
      <div className="scan-pulse-ring ring-3" />
    </div>
  );
}
