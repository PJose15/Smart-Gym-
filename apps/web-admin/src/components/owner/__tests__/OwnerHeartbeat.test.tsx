/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { LiveActivityStrip } from '../LiveActivityStrip';
import { AtRiskList } from '../AtRiskList';
import { MetricCard } from '../MetricCard';
import type { ActivityFeedItem } from '@nexera/types';
import type { AtRiskMember } from '@nexera/ai-assist';

// ── Helpers ──────────────────────────────────────

function makeActivityItem(overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem {
  return {
    id: `act-${Math.random().toString(36).slice(2, 8)}`,
    event_type: 'session_completed',
    description: 'Completed a workout session',
    actor_name: 'TestUser',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAtRiskMember(overrides: Partial<AtRiskMember> = {}): AtRiskMember {
  return {
    profileId: `m-${Math.random().toString(36).slice(2, 8)}`,
    memberName: 'Test Member',
    reasons: [{ type: 'no_workouts_7d', daysSinceLastWorkout: 10 }],
    ...overrides,
  };
}

// ── Hook harnesses ──────────────────────────────

function useLiveGymActivityHarness() {
  const { useLiveGymActivity } = require('@/hooks/useLiveGymActivity');
  const state = useLiveGymActivity();
  return (
    <div>
      <span data-testid="event-count">{state.events.length}</span>
      <span data-testid="live-count">{state.liveCount}</span>
      {state.events.map((e: { id: string; text: string }) => (
        <span key={e.id} data-testid="event">{e.text}</span>
      ))}
    </div>
  );
}
function LiveActivityHarness() { return useLiveGymActivityHarness(); }

function useAtRiskHarness() {
  const { useAtRiskMembers } = require('@/hooks/useAtRiskMembers');
  const state = useAtRiskMembers();
  return (
    <div>
      <span data-testid="member-count">{state.members.length}</span>
      <span data-testid="loading">{String(state.loading)}</span>
      {state.members.map((m: AtRiskMember) => (
        <span key={m.profileId} data-testid="member">{m.memberName}</span>
      ))}
    </div>
  );
}
function AtRiskHarness() { return useAtRiskHarness(); }

// ── Setup ───────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ── T1: New activity event appears after poll ───

test('T1: useLiveGymActivity returns events from API', async () => {
  const items = [makeActivityItem({ id: 'a1', actor_name: 'Alice', description: 'Completed a workout session' })];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => items,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityHarness />);
  });

  expect(result!.getByTestId('event-count').textContent).toBe('1');
  expect(result!.getByTestId('event').textContent).toContain('Alice');
});

// ── T2: Achievement event mapped to correct type ─

test('T2: achievement event mapped correctly', async () => {
  const items = [
    makeActivityItem({ id: 'ach1', event_type: 'achievement_earned', description: 'Earned "10 Sessions"', actor_name: null }),
  ];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => items,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityHarness />);
  });

  expect(result!.getByTestId('event').textContent).toContain('Earned');
});

// ── T3: Events limited to 20 max ───────────────

test('T3: events capped at 20', async () => {
  const items = Array.from({ length: 25 }, (_, i) =>
    makeActivityItem({ id: `ev-${i}`, actor_name: `User${i}` })
  );
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => items,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityHarness />);
  });

  expect(result!.getByTestId('event-count').textContent).toBe('20');
});

// ── T4: liveCount increments on new session events ─

test('T4: liveCount increments when new session events appear', async () => {
  const firstBatch = [makeActivityItem({ id: 's1' })];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => firstBatch,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityHarness />);
  });

  // Initial load — liveCount stays 0 (first load doesn't count)
  expect(result!.getByTestId('live-count').textContent).toBe('0');

  // Second poll with new event
  const secondBatch = [makeActivityItem({ id: 's2' }), ...firstBatch];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => secondBatch,
  });

  await act(async () => {
    jest.advanceTimersByTime(15_000);
  });

  expect(result!.getByTestId('live-count').textContent).toBe('1');
});

// ── T5: Polling interval cleaned up on unmount ──

test('T5: polling interval cleared on unmount', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityHarness />);
  });

  const fetchCountBefore = (global.fetch as jest.Mock).mock.calls.length;
  result!.unmount();

  // Advance time — no more fetches should happen
  await act(async () => {
    jest.advanceTimersByTime(30_000);
  });

  expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountBefore);
});

// ── T6: LiveActivityStrip cycles every 4 seconds ─

test('T6: ticker cycles through events every 4 seconds', async () => {
  const items = [
    makeActivityItem({ id: 'c1', actor_name: 'First', description: 'Did thing 1' }),
    makeActivityItem({ id: 'c2', actor_name: 'Second', description: 'Did thing 2' }),
    makeActivityItem({ id: 'c3', actor_name: 'Third', description: 'Did thing 3' }),
  ];
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => items,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityStrip />);
  });

  // Shows first event
  expect(result!.container.textContent).toContain('First');

  // After 4 seconds, cycles to second
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(result!.container.textContent).toContain('Second');
});

// ── T7: Resets to newest on new event arrival ───

test('T7: resets to index 0 when new event arrives', async () => {
  const batch1 = [
    makeActivityItem({ id: 'r1', actor_name: 'Alpha', description: 'Session 1' }),
    makeActivityItem({ id: 'r2', actor_name: 'Beta', description: 'Session 2' }),
  ];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => batch1,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityStrip />);
  });

  // Advance to show second event
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(result!.container.textContent).toContain('Beta');

  // New poll adds a new event at the front
  const batch2 = [
    makeActivityItem({ id: 'r3', actor_name: 'Gamma', description: 'Session 3' }),
    ...batch1,
  ];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => batch2,
  });

  await act(async () => {
    jest.advanceTimersByTime(15_000);
  });

  // Should reset to newest (Gamma)
  expect(result!.container.textContent).toContain('Gamma');
});

// ── T8: Empty state shown when no events ────────

test('T8: shows waiting message when no events', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<LiveActivityStrip />);
  });

  expect(result!.container.textContent).toContain('Waiting for activity');
});

// ── T9: Member removed from at-risk list on re-fetch ─

test('T9: member removed from at-risk list when they train', async () => {
  const member1 = makeAtRiskMember({ profileId: 'm1', memberName: 'Alice' });
  const member2 = makeAtRiskMember({ profileId: 'm2', memberName: 'Bob' });

  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [member1, member2],
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AtRiskHarness />);
  });

  expect(result!.getByTestId('member-count').textContent).toBe('2');

  // Next poll: Alice trained, only Bob remains
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [member2],
  });

  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });

  expect(result!.getByTestId('member-count').textContent).toBe('1');
  expect(result!.getByTestId('member').textContent).toBe('Bob');
});

// ── T10: Initial at-risk list loads from API ────

test('T10: initial at-risk list loads from API', async () => {
  const members = [
    makeAtRiskMember({ profileId: 'ar1', memberName: 'Charlie' }),
    makeAtRiskMember({ profileId: 'ar2', memberName: 'Diana' }),
  ];
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => members,
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<AtRiskHarness />);
  });

  expect(result!.getByTestId('loading').textContent).toBe('false');
  expect(result!.getByTestId('member-count').textContent).toBe('2');
});

// ── T11: Flash triggers when value increases ────

test('T11: MetricCard flashes when value increases', () => {
  const { container, rerender } = render(
    <MetricCard title="Sessions" value={10} flashOnIncrease />
  );

  // No flash on initial render
  expect(container.querySelector('.metric-card-flash')).toBeFalsy();

  // Increase value
  rerender(<MetricCard title="Sessions" value={15} flashOnIncrease />);
  expect(container.querySelector('.metric-card-flash')).toBeTruthy();

  // After 600ms, flash clears
  act(() => { jest.advanceTimersByTime(600); });
  expect(container.querySelector('.metric-card-flash')).toBeFalsy();
});

// ── T12: No flash when value same or decreases ──

test('T12: MetricCard does not flash on decrease or same value', () => {
  const { container, rerender } = render(
    <MetricCard title="Sessions" value={10} flashOnIncrease />
  );

  // Same value
  rerender(<MetricCard title="Sessions" value={10} flashOnIncrease />);
  expect(container.querySelector('.metric-card-flash')).toBeFalsy();

  // Decrease
  rerender(<MetricCard title="Sessions" value={5} flashOnIncrease />);
  expect(container.querySelector('.metric-card-flash')).toBeFalsy();
});
