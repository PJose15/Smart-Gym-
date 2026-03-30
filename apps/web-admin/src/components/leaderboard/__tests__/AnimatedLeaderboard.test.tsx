/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { AnimatedLeaderboard } from '../AnimatedLeaderboard';
import type { LeaderboardEntry, LeaderboardResponse } from '@nexera/types';
import type { RankChange } from '@/hooks/useLeaderboard';

// ── Mocks ──────────────────────────────────────────

jest.mock('@/lib/ui/haptics', () => ({
  haptics: { light: jest.fn(), success: jest.fn(), celebration: jest.fn() },
}));

jest.mock('@/lib/ui/confetti', () => ({
  launchBottomConfetti: jest.fn(),
  launchTopConfetti: jest.fn(),
}));

import { haptics } from '@/lib/ui/haptics';
import { launchTopConfetti } from '@/lib/ui/confetti';
import { useLeaderboard } from '@/hooks/useLeaderboard';

// ── Helpers ────────────────────────────────────────

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank: 4,
    profile_id: 'p1',
    full_name: 'Test User',
    avatar_url: null,
    total_points: 500,
    is_current_user: false,
    ...overrides,
  };
}

function makeResponse(myRank: number | null, entries: LeaderboardEntry[]): LeaderboardResponse {
  return { entries, my_rank: myRank, total_participants: entries.length };
}

const defaultEntries: LeaderboardEntry[] = [
  makeEntry({ rank: 4, profile_id: 'p1', full_name: 'Alice', total_points: 400 }),
  makeEntry({ rank: 5, profile_id: 'p2', full_name: 'You', total_points: 350, is_current_user: true }),
  makeEntry({ rank: 6, profile_id: 'p3', full_name: 'Bob', total_points: 300 }),
];

function renderComponent(overrides: Partial<React.ComponentProps<typeof AnimatedLeaderboard>> = {}) {
  const props = {
    entries: defaultEntries,
    myRank: 5,
    totalParticipants: 20,
    rankChange: null as RankChange | null,
    onRankChangeAnimated: jest.fn(),
    ...overrides,
  };
  const result = render(<AnimatedLeaderboard {...props} />);
  return { ...result, props };
}

// ── Hook wrapper for testing useLeaderboard ────────

function HookHarness({ memberId, gymId }: { memberId: string; gymId: string }) {
  const state = useLeaderboard(memberId, gymId);
  return (
    <div>
      <span data-testid="loading">{String(state.loading)}</span>
      <span data-testid="period">{state.period}</span>
      <span data-testid="my-rank">{state.data?.my_rank ?? 'null'}</span>
      <span data-testid="rank-delta">{state.rankChange?.delta ?? 'null'}</span>
      <span data-testid="is-number1">{String(state.rankChange?.isNewNumber1 ?? 'null')}</span>
      <button data-testid="set-all-time" onClick={() => state.setPeriod('all_time')}>All Time</button>
      <button data-testid="clear" onClick={state.clearRankChange}>Clear</button>
    </div>
  );
}

// ── Setup ──────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ── Tests ──────────────────────────────────────────

// T1: Hook returns loading=true then data
test('T1: useLeaderboard returns loading then data', async () => {
  const response = makeResponse(5, defaultEntries);
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => response,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  expect(result!.getByTestId('loading').textContent).toBe('false');
  expect(result!.getByTestId('my-rank').textContent).toBe('5');
});

// T2: Rank improvement detected (5->3)
test('T2: rank improvement 5->3 yields delta=2, isNewNumber1=false', async () => {
  // First fetch — sets baseline rank 5
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(5, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });
  expect(result!.getByTestId('rank-delta').textContent).toBe('null');

  // Second fetch — rank improved to 3
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(3, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-changed" />);
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('2');
  expect(result!.getByTestId('is-number1').textContent).toBe('false');
});

// T3: Rank 1 achievement detected
test('T3: reaching rank 1 sets isNewNumber1=true', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(3, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(1, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-v2" />);
  });

  expect(result!.getByTestId('is-number1').textContent).toBe('true');
  expect(result!.getByTestId('rank-delta').textContent).toBe('2');
});

// T4: Same rank ignored
test('T4: same rank produces no rankChange', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(5, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(5, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-v2" />);
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('null');
});

// T5: Rank worsening ignored
test('T5: rank worsening produces no rankChange', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(3, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(7, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-v2" />);
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('null');
});

// T6: clearRankChange resets
test('T6: clearRankChange resets rankChange to null', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(5, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(2, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-v2" />);
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('3');

  await act(async () => {
    result!.getByTestId('clear').click();
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('null');
});

// T7: Period switch clears rankChange
test('T7: switching period clears rankChange', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(5, defaultEntries),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" gymId="g1" />);
  });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(2, defaultEntries),
  });

  await act(async () => {
    result!.rerender(<HookHarness memberId="m1" gymId="g1-v2" />);
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('3');

  // Switch to all_time — should clear
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => makeResponse(10, defaultEntries),
  });

  await act(async () => {
    result!.getByTestId('set-all-time').click();
  });

  expect(result!.getByTestId('rank-delta').textContent).toBe('null');
  expect(result!.getByTestId('period').textContent).toBe('all_time');
});

// T8: Component renders rows with stagger delay
test('T8: rows have --row-index CSS variable for stagger', () => {
  const { container } = renderComponent();
  const rows = container.querySelectorAll('.lb-row-animated');
  expect(rows.length).toBe(3);
  // Verify --row-index is set on each row via style attribute
  const row0Style = (rows[0] as HTMLElement).getAttribute('style') || '';
  const row1Style = (rows[1] as HTMLElement).getAttribute('style') || '';
  const row2Style = (rows[2] as HTMLElement).getAttribute('style') || '';
  expect(row0Style).toContain('--row-index');
  expect(row1Style).toContain('--row-index');
  expect(row2Style).toContain('--row-index');
});

// T9: Rank 1 triggers launchTopConfetti + haptics.celebration
test('T9: rank 1 triggers confetti and celebration haptics', () => {
  const rc: RankChange = { previousRank: 3, currentRank: 1, delta: 2, isNewNumber1: true };
  renderComponent({ rankChange: rc });

  // haptics.success fires immediately
  expect(haptics.success).toHaveBeenCalledTimes(1);

  // confetti + celebration fire after 600ms delay
  expect(launchTopConfetti).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(600); });
  expect(launchTopConfetti).toHaveBeenCalledTimes(1);
  expect(haptics.celebration).toHaveBeenCalledTimes(1);
});

// T10: launchTopConfetti respects reduced-motion (direct module test)
test('T10: launchTopConfetti skips DOM when reduced-motion is preferred', () => {
  // Mock matchMedia to return prefers-reduced-motion: reduce
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    onchange: null,
    dispatchEvent: jest.fn(),
  }));

  // Use fresh require to get actual (unmocked) module
  jest.resetModules();
  const { launchTopConfetti: actualLaunchTop } = jest.requireActual('@/lib/ui/confetti') as {
    launchTopConfetti: () => void;
  };

  const before = document.body.children.length;
  actualLaunchTop();
  const after = document.body.children.length;

  expect(after).toBe(before); // No DOM nodes added

  // Restore
  window.matchMedia = originalMatchMedia;
});

// T11: Toast auto-dismisses after 3s + 250ms exit animation
test('T11: toast auto-dismisses and calls onRankChangeAnimated', () => {
  const rc: RankChange = { previousRank: 5, currentRank: 3, delta: 2, isNewNumber1: false };
  const onAnimated = jest.fn();
  const { container } = render(
    <AnimatedLeaderboard
      entries={defaultEntries}
      myRank={3}
      totalParticipants={20}
      rankChange={rc}
      onRankChangeAnimated={onAnimated}
    />
  );

  // Toast visible initially
  expect(container.querySelector('.lb-rank-toast')).toBeTruthy();
  expect(onAnimated).not.toHaveBeenCalled();

  // After 3s, exit class should be applied
  act(() => { jest.advanceTimersByTime(3000); });
  expect(container.querySelector('.lb-rank-toast--exit')).toBeTruthy();

  // After another 250ms, callback fires
  act(() => { jest.advanceTimersByTime(250); });
  expect(onAnimated).toHaveBeenCalledTimes(1);
});

// T12: Empty entries array renders without crashing
test('T12: renders with empty entries without crashing', () => {
  const { container } = renderComponent({ entries: [], myRank: null });
  const rows = container.querySelectorAll('.lb-row-animated');
  expect(rows.length).toBe(0);
  // No "Your Position" card when myRank is null
  expect(container.textContent).not.toContain('Your Position');
});
