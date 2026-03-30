'use client';

import { useRef } from 'react';
import { haptics } from '@/lib/ui/haptics';

interface RollingNumberProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  step: number;
  min?: number;
  max?: number;
}

export function RollingNumber({
  value,
  onChange,
  unit,
  step,
  min = 0,
  max = 9999,
}: RollingNumberProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function increment() {
    const next = Math.min(max, value + step);
    onChange(next);
    haptics.light();
  }

  function decrement() {
    const next = Math.max(min, value - step);
    if (next === value) return;
    onChange(next);
    haptics.light();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min);
      return;
    }
    const parsed = Math.floor(Number(raw));
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  }

  return (
    <div className="rolling-number-wrapper">
      <button
        type="button"
        className="stepper-btn stepper-minus"
        onClick={decrement}
        aria-label={`Decrease ${unit}`}
        disabled={value <= min}
      >
        &minus;
      </button>

      <div
        className="number-display"
        onClick={() => inputRef.current?.select()}
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          className="number-input"
          value={value || ''}
          onChange={handleInputChange}
          aria-label={`Enter ${unit}`}
        />
        <div className="number-unit">{unit}</div>
      </div>

      <button
        type="button"
        className="stepper-btn stepper-plus"
        onClick={increment}
        aria-label={`Increase ${unit}`}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
