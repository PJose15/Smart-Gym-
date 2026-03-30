/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { DayCompleteRitual, type DayCompleteRitualProps } from '../DayCompleteRitual';
import { haptics } from '@/lib/ui/haptics';

jest.mock('@/lib/ui/haptics', () => ({
  haptics: { light: jest.fn(), success: jest.fn(), celebration: jest.fn() },
}));

const defaultProps: DayCompleteRitualProps = {
  dayNumber: 3,
  weekNumber: 2,
  stats: { machinesCount: 5, totalVolumeLbs: 12500, prsHit: 2 },
  nextSessionDay: 'Wednesday',
  isRestDay: false,
  onComplete: jest.fn(),
};

function renderRitual(overrides: Partial<DayCompleteRitualProps> = {}) {
  return render(<DayCompleteRitual {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // Mock matchMedia for reduced-motion check (jsdom doesn't provide it)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// T1: Phases progress through all 6 states via fake timers
test('phases progress through all 6 states', () => {
  const { queryByText, container } = renderRitual();

  // blackout: no day number yet
  expect(queryByText('Day 3')).toBeNull();

  // 300ms → day-number
  act(() => { jest.advanceTimersByTime(300); });
  expect(queryByText('Day 3')).not.toBeNull();

  // 700ms → complete
  act(() => { jest.advanceTimersByTime(400); });
  expect(queryByText('COMPLETE.')).not.toBeNull();

  // 1100ms → stats
  act(() => { jest.advanceTimersByTime(400); });
  expect(container.querySelector('.ritual-stats')).not.toBeNull();

  // 2000ms → rest-day
  act(() => { jest.advanceTimersByTime(900); });
  // rest-day phase reached (no rest message since isRestDay=false)
  // Stats remain visible through rest-day phase transition (inclusive visibility)
  expect(container.querySelector('.ritual-stats')).not.toBeNull();

  // 2700ms → done-btn
  act(() => { jest.advanceTimersByTime(700); });
  expect(queryByText('Done')).not.toBeNull();
});

// T2: Day number shows correct number text
test('day number shows correct text', () => {
  const { getByText } = renderRitual({ dayNumber: 5 });
  act(() => { jest.advanceTimersByTime(300); });
  expect(getByText('Day 5')).toBeTruthy();
});

// T3: Stats render correct values
test('stats render correct values', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 4, totalVolumeLbs: 8500, prsHit: 1 },
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const pills = container.querySelectorAll('.ritual-stat-pill');
  expect(pills).toHaveLength(3);

  const values = Array.from(pills).map((p) => p.querySelector('.pill-value')?.textContent);
  expect(values[0]).toBe('4');
  expect(values[1]).toBe('8.5k');
  expect(values[2]).toBe('1 PR');
});

// T4: Gold stat pill when prsHit > 0
test('gold stat pill when prsHit > 0', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 3, totalVolumeLbs: 5000, prsHit: 3 },
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const goldPills = container.querySelectorAll('.ritual-stat-pill.gold');
  expect(goldPills).toHaveLength(1);
  expect(goldPills[0].querySelector('.pill-value')?.textContent).toBe('3 PRs');
});

// T5: Week progress pill when prsHit = 0
test('week progress pill when prsHit = 0', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 3, totalVolumeLbs: 5000, prsHit: 0 },
    weekNumber: 4,
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const pills = container.querySelectorAll('.ritual-stat-pill');
  const lastPill = pills[pills.length - 1];
  expect(lastPill.classList.contains('gold')).toBe(false);
  expect(lastPill.querySelector('.pill-value')?.textContent).toBe('Week 4');
  expect(lastPill.querySelector('.pill-label')?.textContent).toBe('progress');
});

// T6: Rest message shows when isRestDay=true + nextSessionDay set
test('rest message shows when isRestDay and nextSessionDay', () => {
  const { queryByText } = renderRitual({ isRestDay: true, nextSessionDay: 'Friday' });
  act(() => { jest.advanceTimersByTime(2000); });
  expect(queryByText(/Rest up/)).not.toBeNull();
  expect(queryByText(/Friday/)).not.toBeNull();
});

// T7: Rest message hidden when isRestDay=false
test('rest message hidden when isRestDay is false', () => {
  const { queryByText } = renderRitual({ isRestDay: false, nextSessionDay: 'Friday' });
  act(() => { jest.advanceTimersByTime(2000); });
  expect(queryByText(/Rest up/)).toBeNull();
});

// T8: Done button appears at 2700ms, not before
test('done button appears at 2700ms not before', () => {
  const { queryByText } = renderRitual();

  act(() => { jest.advanceTimersByTime(2600); });
  expect(queryByText('Done')).toBeNull();

  act(() => { jest.advanceTimersByTime(100); });
  expect(queryByText('Done')).not.toBeNull();
});

// T9: onComplete fires when Done clicked
test('onComplete fires on Done click', () => {
  const onComplete = jest.fn();
  const { getByText } = renderRitual({ onComplete });

  act(() => { jest.advanceTimersByTime(2700); });
  fireEvent.click(getByText('Done'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

// T10: haptics.celebration fires at 2700ms
test('haptics.celebration fires at 2700ms', () => {
  renderRitual();

  expect(haptics.light).toHaveBeenCalledTimes(1);
  expect(haptics.celebration).not.toHaveBeenCalled();

  act(() => { jest.advanceTimersByTime(2700); });
  expect(haptics.celebration).toHaveBeenCalledTimes(1);
});

// T11: Unmount during timer sequence does not error
test('unmount during timer sequence does not error', () => {
  const { unmount } = renderRitual();
  act(() => { jest.advanceTimersByTime(500); });
  unmount();
  // Drain remaining timers — should not throw or set state on unmounted component
  act(() => { jest.advanceTimersByTime(3000); });
});

// T12: aria-label on day number element
test('day number has aria-label', () => {
  const { container } = renderRitual({ dayNumber: 7 });
  act(() => { jest.advanceTimersByTime(300); });
  const el = container.querySelector('.ritual-day-number');
  expect(el?.getAttribute('aria-label')).toBe('Day 7');
});

// T13: dialog role, aria-modal, and data-testid
test('renders with role=dialog and aria-modal', () => {
  const { container, getByTestId } = renderRitual();
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.getAttribute('aria-modal')).toBe('true');
  expect(dialog?.getAttribute('aria-label')).toBe('Day complete celebration');
  // Validate data-testid is present and queryable for integration tests
  expect(getByTestId('day-complete-ritual')).toBeTruthy();
});

// T14: Volume below 1000 renders raw number
test('volume below 1000 renders raw number', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 2, totalVolumeLbs: 750, prsHit: 0 },
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const pills = container.querySelectorAll('.ritual-stat-pill');
  expect(pills[1].querySelector('.pill-value')?.textContent).toBe('750');
});

// T15: Singular "machine" when count is 1
test('singular machine label when count is 1', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 1, totalVolumeLbs: 5000, prsHit: 0 },
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const pills = container.querySelectorAll('.ritual-stat-pill');
  expect(pills[0].querySelector('.pill-label')?.textContent).toBe('machine');
});

// T16: Volume exactly 1000 shows "1k" not "1.0k"
test('volume exactly 1000 shows clean k', () => {
  const { container } = renderRitual({
    stats: { machinesCount: 2, totalVolumeLbs: 1000, prsHit: 0 },
  });
  act(() => { jest.advanceTimersByTime(1100); });

  const pills = container.querySelectorAll('.ritual-stat-pill');
  expect(pills[1].querySelector('.pill-value')?.textContent).toBe('1k');
});

// T17: Escape key calls onComplete
test('escape key calls onComplete', () => {
  const onComplete = jest.fn();
  const { container } = renderRitual({ onComplete });
  act(() => { jest.advanceTimersByTime(2700); });

  const dialog = container.querySelector('[role="dialog"]')!;
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

// T18: Reduced motion skips timer sequence, shows all content at 100ms
test('reduced motion jumps to done-btn at 100ms with all content visible', () => {
  // Override matchMedia to simulate prefers-reduced-motion
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  const { queryByText, container } = renderRitual({ isRestDay: true, nextSessionDay: 'Friday' });

  // Before 100ms: still in blackout
  expect(queryByText('Done')).toBeNull();

  // At 100ms: jumps straight to done-btn phase (phaseIdx=5, all content visible)
  act(() => { jest.advanceTimersByTime(100); });

  expect(queryByText('Day 3')).not.toBeNull();
  expect(queryByText('COMPLETE.')).not.toBeNull();
  expect(container.querySelector('.ritual-stats')).not.toBeNull();
  expect(queryByText(/Rest up/)).not.toBeNull();
  expect(queryByText('Done')).not.toBeNull();
  expect(haptics.celebration).toHaveBeenCalledTimes(1);

  // No additional timers fire — draining shouldn't change anything
  act(() => { jest.advanceTimersByTime(3000); });
  expect(haptics.celebration).toHaveBeenCalledTimes(1);
});

// T19: Tab key is trapped and focuses done button
test('tab key is trapped within dialog', () => {
  const { container } = renderRitual();
  act(() => { jest.advanceTimersByTime(2700); });

  const dialog = container.querySelector('[role="dialog"]')!;
  const doneBtn = container.querySelector('.ritual-done-btn') as HTMLButtonElement;

  // Blur done button first so we can verify focus moves back to it
  doneBtn.blur();

  const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  const preventSpy = jest.spyOn(tabEvent, 'preventDefault');
  dialog.dispatchEvent(tabEvent);

  expect(preventSpy).toHaveBeenCalled();
  expect(document.activeElement).toBe(doneBtn);
});
