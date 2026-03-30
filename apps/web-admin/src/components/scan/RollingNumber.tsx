'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { haptics } from '@/lib/ui/haptics';

interface RollingNumberProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  suggestion?: { suggested_weight: number | null } | null;
  target?: number | null;
}

const HOLD_DELAY = 400;
const RAPID_INTERVAL = 120;

export function RollingNumber({
  value,
  onChange,
  unit,
  step,
  min = 0,
  max = 9999,
  suggestion,
  target,
}: RollingNumberProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const numberDisplayRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rapidTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didRapidRef = useRef(false);
  const isRapidRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const [rollKey, setRollKey] = useState(0);
  const [prevValue, setPrevValue] = useState(value);

  // Track previous value for roll animation
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setPrevValue(lastValueRef.current);
      setRollKey((k) => k + 1);
      lastValueRef.current = value;
    }
  }, [value]);

  const clearTimers = useCallback(() => {
    isRapidRef.current = false;
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (rapidTimerRef.current !== null) {
      clearInterval(rapidTimerRef.current);
      rapidTimerRef.current = null;
      // Bounce on rapid-fire release
      numberDisplayRef.current?.classList.add('rapid-stop');
      bounceTimerRef.current = setTimeout(() => {
        numberDisplayRef.current?.classList.remove('rapid-stop');
        bounceTimerRef.current = null;
      }, 250);
    }
  }, []);

  // Cleanup ALL timers on unmount (C-001 fix)
  useEffect(() => {
    return () => {
      isRapidRef.current = false;
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
      if (rapidTimerRef.current !== null) clearInterval(rapidTimerRef.current);
      if (bounceTimerRef.current !== null) clearTimeout(bounceTimerRef.current);
      holdTimerRef.current = null;
      rapidTimerRef.current = null;
      bounceTimerRef.current = null;
    };
  }, []);

  // Ref to always have current value in rapid-fire interval
  const valueRef = useRef(value);
  valueRef.current = value;

  const doStep = useCallback(
    (dir: 1 | -1) => {
      if (!isRapidRef.current) return; // H-001: guard against stale interval callbacks
      const cur = valueRef.current;
      const next = dir === 1 ? Math.min(max, cur + step) : Math.max(min, cur - step);
      if (next !== cur) {
        onChange(next);
        haptics.light();
      }
    },
    [onChange, step, min, max],
  );

  function increment() {
    if (didRapidRef.current) { didRapidRef.current = false; return; }
    const next = Math.min(max, value + step);
    if (next === value) return;
    setDirection(-1); // roll up for increment
    onChange(next);
    haptics.light();
  }

  function decrement() {
    if (didRapidRef.current) { didRapidRef.current = false; return; }
    const next = Math.max(min, value - step);
    if (next === value) return;
    setDirection(1); // roll down for decrement
    onChange(next);
    haptics.light();
  }

  function startHold(dir: 1 | -1) {
    const rollDir: -1 | 1 = dir === 1 ? -1 : 1;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      didRapidRef.current = true;
      isRapidRef.current = true;
      rapidTimerRef.current = setInterval(() => {
        setDirection(rollDir);
        doStep(dir);
      }, RAPID_INTERVAL);
    }, HOLD_DELAY);
  }

  function handlePointerDown(dir: 1 | -1) {
    didRapidRef.current = false;
    startHold(dir);
  }

  function handlePointerUp() {
    clearTimers();
  }

  function handlePointerLeave() {
    clearTimers();
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

  function handleInputBlur() {
    setEditing(false);
  }

  function handleDisplayClick() {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  // Clamp display value defensively in case parent passes out-of-range
  const displayValue = Math.max(min, Math.min(max, value));

  const isSuggested = suggestion?.suggested_weight != null && displayValue === suggestion.suggested_weight;
  const isTarget = target != null && displayValue === target;

  const displayClasses = [
    'number-display',
    isSuggested ? 'is-suggested' : '',
    isTarget ? 'is-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Direction classes for the roll
  const enterClass = direction === -1 ? 'roll-up' : 'roll-down';
  const exitClass = direction === -1 ? 'roll-exit-up' : 'roll-exit-down';

  return (
    <div className="rolling-number-wrapper rolling-number">
      <button
        type="button"
        className="stepper-btn stepper-minus"
        onClick={decrement}
        onPointerDown={() => handlePointerDown(-1)}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label={`Decrease ${unit} by ${step}`}
        disabled={value <= min}
      >
        &minus;
      </button>

      <div
        ref={numberDisplayRef}
        className={displayClasses}
        onClick={!editing ? handleDisplayClick : undefined}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            className="number-input"
            value={displayValue || ''}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            role="spinbutton"
            aria-label={`Enter ${unit}`}
            aria-valuenow={displayValue}
            aria-valuemin={min}
            aria-valuemax={max}
          />
        ) : (
          <div className="number-clip" aria-live="polite" aria-atomic="true">
            {/* Exiting value */}
            <span
              key={`exit-${rollKey}`}
              className={`number-value ${exitClass}`}
              aria-hidden="true"
            >
              {prevValue}
            </span>
            {/* Entering value */}
            <span
              key={`enter-${rollKey}`}
              className={`number-value ${enterClass}`}
            >
              {displayValue}
            </span>
          </div>
        )}
        {isSuggested && <span className="number-suggestion-dot" aria-hidden="true" />}
        <div className="number-unit">{unit}</div>
      </div>

      <button
        type="button"
        className="stepper-btn stepper-plus"
        onClick={increment}
        onPointerDown={() => handlePointerDown(1)}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label={`Increase ${unit} by ${step}`}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
