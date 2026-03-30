/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { RollingNumber } from '../RollingNumber';
import { haptics } from '@/lib/ui/haptics';

jest.mock('@/lib/ui/haptics', () => ({
  haptics: { light: jest.fn(), success: jest.fn() },
}));

function renderCounter(overrides: Partial<React.ComponentProps<typeof RollingNumber>> = {}) {
  const props = {
    value: 50,
    onChange: jest.fn(),
    unit: 'lbs',
    step: 5,
    min: 0,
    max: 200,
    ...overrides,
  };
  const result = render(<RollingNumber {...props} />);
  return { ...result, props };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// T1: Renders with initial value
test('renders with initial value', () => {
  const { container } = renderCounter({ value: 100 });
  const values = container.querySelectorAll('.number-value');
  // Entering value should show 100
  const texts = Array.from(values).map((el) => el.textContent);
  expect(texts).toContain('100');
});

// T2: Click + increments by step
test('click + increments by step', () => {
  const { container, props } = renderCounter({ value: 50 });
  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.click(plusBtn);
  expect(props.onChange).toHaveBeenCalledWith(55);
});

// T3: Click - decrements by step
test('click - decrements by step', () => {
  const { container, props } = renderCounter({ value: 50 });
  const minusBtn = container.querySelector('.stepper-minus')!;
  fireEvent.click(minusBtn);
  expect(props.onChange).toHaveBeenCalledWith(45);
});

// T4: Cannot go below min
test('cannot go below min', () => {
  const { container } = renderCounter({ value: 0, min: 0 });
  const minusBtn = container.querySelector('.stepper-minus') as HTMLButtonElement;
  expect(minusBtn.disabled).toBe(true);
});

// T5: Cannot go above max
test('cannot go above max', () => {
  const { container } = renderCounter({ value: 200, max: 200 });
  const plusBtn = container.querySelector('.stepper-plus') as HTMLButtonElement;
  expect(plusBtn.disabled).toBe(true);
});

// T6: onChange called with correct value
test('onChange called with correct clamped value', () => {
  const { container, props } = renderCounter({ value: 198, max: 200, step: 5 });
  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.click(plusBtn);
  // Should clamp to max
  expect(props.onChange).toHaveBeenCalledWith(200);
});

// T7: Haptic fires on increment/decrement
test('haptic fires on step', () => {
  const { container } = renderCounter({ value: 50 });
  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.click(plusBtn);
  expect(haptics.light).toHaveBeenCalled();
});

// T8: Direction class correct on increment (roll-up)
test('direction class roll-up on increment', () => {
  const onChange = jest.fn();
  const { container, rerender } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} />
  );

  // Click + to increment
  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.click(plusBtn);

  // Re-render with new value to trigger the effect
  rerender(<RollingNumber value={55} onChange={onChange} unit="lbs" step={5} />);

  const enterValues = container.querySelectorAll('.number-value.roll-up');
  expect(enterValues.length).toBeGreaterThan(0);
});

// T9: Direction class correct on decrement (roll-down)
test('direction class roll-down on decrement', () => {
  const onChange = jest.fn();
  const { container, rerender } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} />
  );

  const minusBtn = container.querySelector('.stepper-minus')!;
  fireEvent.click(minusBtn);

  rerender(<RollingNumber value={45} onChange={onChange} unit="lbs" step={5} />);

  const enterValues = container.querySelectorAll('.number-value.roll-down');
  expect(enterValues.length).toBeGreaterThan(0);
});

// T10: Long press starts rapid fire after 400ms
test('long press starts rapid fire after 400ms', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { container } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} max={200} />
  );

  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.pointerDown(plusBtn);

  // Before hold delay — no rapid fire
  act(() => { jest.advanceTimersByTime(399); });
  onChange.mockClear();

  // After hold delay + one interval tick
  act(() => { jest.advanceTimersByTime(121); });
  expect(onChange).toHaveBeenCalled();

  // Cleanup
  fireEvent.pointerUp(plusBtn);
  jest.useRealTimers();
});

// T11: Rapid fire clears on pointerup
test('rapid fire clears on pointerup', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { container } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} max={200} />
  );

  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.pointerDown(plusBtn);

  // Trigger rapid mode
  act(() => { jest.advanceTimersByTime(520); });
  onChange.mockClear();

  // Release
  fireEvent.pointerUp(plusBtn);

  // More time passes — no additional calls
  act(() => { jest.advanceTimersByTime(500); });
  expect(onChange).not.toHaveBeenCalled();

  jest.useRealTimers();
});

// T12: Rapid fire clears on pointerleave
test('rapid fire clears on pointerleave', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { container } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} max={200} />
  );

  const plusBtn = container.querySelector('.stepper-plus')!;
  fireEvent.pointerDown(plusBtn);

  act(() => { jest.advanceTimersByTime(520); });
  onChange.mockClear();

  // Leave the button
  fireEvent.pointerLeave(plusBtn);

  act(() => { jest.advanceTimersByTime(500); });
  expect(onChange).not.toHaveBeenCalled();

  jest.useRealTimers();
});

// T13: is-suggested class when value matches suggestion
test('is-suggested class when value matches suggestion', () => {
  const { container } = renderCounter({
    value: 100,
    suggestion: { suggested_weight: 100 },
  });
  const display = container.querySelector('.number-display');
  expect(display?.classList.contains('is-suggested')).toBe(true);
});

// T14: is-target class when value matches target
test('is-target class when value matches target', () => {
  const { container } = renderCounter({
    value: 75,
    target: 75,
  });
  const display = container.querySelector('.number-display');
  expect(display?.classList.contains('is-target')).toBe(true);
});

// T15: Suggestion dot renders when value matches suggestion
test('suggestion dot renders when value matches suggestion', () => {
  const { container } = renderCounter({
    value: 100,
    suggestion: { suggested_weight: 100 },
  });
  const dot = container.querySelector('.number-suggestion-dot');
  expect(dot).not.toBeNull();
});

// T16: Null suggestion weight does NOT add is-suggested class
test('null suggestion weight does not add is-suggested', () => {
  const { container } = renderCounter({
    value: 100,
    suggestion: { suggested_weight: null },
  });
  const display = container.querySelector('.number-display');
  expect(display?.classList.contains('is-suggested')).toBe(false);
  expect(container.querySelector('.number-suggestion-dot')).toBeNull();
});

// T17: No extra onChange after long-press release (C2 double-fire fix)
test('no extra onChange after long-press release', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { container } = render(
    <RollingNumber value={50} onChange={onChange} unit="lbs" step={5} max={200} />
  );

  const plusBtn = container.querySelector('.stepper-plus')!;

  // Start pointer down — begins hold timer
  fireEvent.pointerDown(plusBtn);

  // Advance past hold delay + one rapid tick to enter rapid mode
  act(() => { jest.advanceTimersByTime(520); });
  const callsDuringRapid = onChange.mock.calls.length;
  expect(callsDuringRapid).toBeGreaterThan(0);

  // Release — fires pointerUp then click
  onChange.mockClear();
  fireEvent.pointerUp(plusBtn);
  fireEvent.click(plusBtn);

  // The click should NOT produce an extra onChange call
  expect(onChange).not.toHaveBeenCalled();

  jest.useRealTimers();
});
