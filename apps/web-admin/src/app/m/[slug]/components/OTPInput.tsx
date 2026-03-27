'use client';

import { useRef, useCallback, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]!.focus();
    }
  }, [length]);

  const updateValue = useCallback(
    (newDigits: string[]) => {
      const code = newDigits.join('');
      onChange(code);
      if (code.length === length && /^\d+$/.test(code)) {
        onComplete(code);
      }
    },
    [onChange, onComplete, length]
  );

  const handleChange = useCallback(
    (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value.replace(/\D/g, '').slice(-1);
      if (!char) return;

      const newDigits = [...digits];
      newDigits[index] = char;
      updateValue(newDigits);

      // Auto-advance to next box
      if (index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, updateValue, focusInput, length]
  );

  const handleKeyDown = useCallback(
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const newDigits = [...digits];
        if (digits[index]) {
          // Clear current digit
          newDigits[index] = '';
          updateValue(newDigits);
        } else if (index > 0) {
          // Move back and clear previous
          newDigits[index - 1] = '';
          updateValue(newDigits);
          focusInput(index - 1);
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [digits, updateValue, focusInput, length]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;

      const newDigits = pasted.split('').concat(Array(length).fill('')).slice(0, length);
      updateValue(newDigits);

      // Focus the box after the last pasted digit
      const nextIndex = Math.min(pasted.length, length - 1);
      focusInput(nextIndex);
    },
    [updateValue, focusInput, length]
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digits[i] || ''}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: 'var(--tap-target-min)',
            height: 'var(--tap-target-lg)',
            borderRadius: 'var(--radius-md)',
            border: `2px solid ${
              digits[i]
                ? 'var(--color-blue)'
                : 'var(--color-border-default)'
            }`,
            backgroundColor: 'var(--color-bg-raised)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            outline: 'none',
            transition: `border-color var(--duration-fast) var(--ease-default),
                         box-shadow var(--duration-fast) var(--ease-default)`,
            caretColor: 'transparent',
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  );
}
