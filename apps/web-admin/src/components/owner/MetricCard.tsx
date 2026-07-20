'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 10,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  transition: 'border-color 300ms ease-out',
  border: '1px solid transparent',
};

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  placeholder?: boolean;
  /** When true, flash green on value increase (not on initial render). */
  flashOnIncrease?: boolean;
}

export function MetricCard({ title, value, subtitle, change, placeholder, flashOnIncrease }: Props) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<string | number>(value);
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      prevValueRef.current = value;
      return;
    }

    if (
      flashOnIncrease &&
      typeof value === 'number' &&
      typeof prevValueRef.current === 'number' &&
      value > prevValueRef.current
    ) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 600);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }

    prevValueRef.current = value;
  }, [value, flashOnIncrease]);

  const flashBorder = isFlashing ? '1px solid rgba(0, 200, 150,0.3)' : '1px solid transparent';

  return (
    <div
      className={isFlashing ? 'metric-card-flash' : ''}
      style={{ ...cardStyle, border: flashBorder }}
    >
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: placeholder ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {change !== undefined && (
        <div style={{ fontSize: 12, color: change >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {change >= 0 ? '+' : ''}{change}% vs last week
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{subtitle}</div>
      )}
    </div>
  );
}
