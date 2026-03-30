'use client';

import type { ReadinessZone } from '@nexera/types';
import { ZONE_COLORS } from '@nexera/ai-assist';

interface ReadinessDotProps {
  zone: ReadinessZone;
}

export function ReadinessDot({ zone }: ReadinessDotProps) {
  const color = ZONE_COLORS[zone];

  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: zone === 'peak' ? `0 0 6px ${color}` : 'none',
        animation: zone === 'peak' ? 'readinessDotPulse 2s ease-in-out infinite' : 'none',
      }}
    />
  );
}
