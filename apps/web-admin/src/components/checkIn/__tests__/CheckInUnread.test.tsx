/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { CheckInMessage } from '../CheckInMessage';
import { BottomNav } from '../../nav/BottomNav';
import { isSundayAnticipation, getMinutesUntilSixPM } from '@/lib/sundayAnticipation';

// ── Mocks ──────────────────────────────────────────

jest.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../NexeraCoachAvatar', () => ({
  NexeraCoachAvatar: () => <div data-testid="coach-avatar" />,
}));

jest.mock('../StatPill', () => ({
  StatPill: ({ label }: { label: string }) => <span data-testid={`stat-${label}`} />,
}));

// ── Helpers ────────────────────────────────────────

function makeCheckIn(overrides = {}) {
  return {
    id: 'ci-1',
    member_id: 'm1',
    gym_id: 'g1',
    trainer_id: null,
    week_start: '2026-03-23',
    week_end: '2026-03-29',
    ai_draft: 'draft',
    final_message: 'Great week!',
    sent_by: 'ai' as const,
    trainer_approved: false,
    trainer_approved_at: null,
    sent_at: '2026-03-29T18:00:00Z',
    member_replied: false,
    reply_text: null,
    replied_at: null,
    sessions_this_week: 4,
    sessions_last_week: 3,
    total_volume_lbs: 12500,
    prs_this_week: 1,
    current_streak: 8,
    week_data_snapshot: {} as unknown,
    created_at: '2026-03-29T18:00:00Z',
    updated_at: '2026-03-29T18:00:00Z',
    ...overrides,
  } as import('@nexera/types').CheckInRecord;
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

// ── Hook Tests ────────────────────────────────────

// We test the hook via a harness component
import { useUnreadCheckIn } from '@/hooks/useUnreadCheckIn';

function HookHarness({ memberId }: { memberId: string }) {
  const state = useUnreadCheckIn(memberId);
  return (
    <div>
      <span data-testid="hasUnread">{String(state.hasUnread)}</span>
      <span data-testid="checkInId">{state.checkInId ?? 'null'}</span>
      <button data-testid="markRead" onClick={state.markRead}>Mark Read</button>
    </div>
  );
}

// T1: Hook returns hasUnread=true when API reports unread
test('T1: useUnreadCheckIn returns hasUnread=true when API reports unread', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ hasUnread: true, checkInId: 'ci-1' }),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" />);
  });

  expect(result!.getByTestId('hasUnread').textContent).toBe('true');
  expect(result!.getByTestId('checkInId').textContent).toBe('ci-1');
});

// T2: Hook returns hasUnread=false when none
test('T2: useUnreadCheckIn returns hasUnread=false when none', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ hasUnread: false, checkInId: null }),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" />);
  });

  expect(result!.getByTestId('hasUnread').textContent).toBe('false');
  expect(result!.getByTestId('checkInId').textContent).toBe('null');
});

// T3: markRead PATCHes API and clears hasUnread
test('T3: markRead PATCHes API and optimistically clears hasUnread', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ hasUnread: true, checkInId: 'ci-1' }),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HookHarness memberId="m1" />);
  });

  expect(result!.getByTestId('hasUnread').textContent).toBe('true');

  // Mock the PATCH call
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true }),
  });

  await act(async () => {
    result!.getByTestId('markRead').click();
  });

  expect(result!.getByTestId('hasUnread').textContent).toBe('false');
  expect(result!.getByTestId('checkInId').textContent).toBe('null');

  // Verify PATCH was called
  const patchCall = (global.fetch as jest.Mock).mock.calls.find(
    (c: unknown[]) => typeof c[1] === 'object' && (c[1] as { method: string }).method === 'PATCH'
  );
  expect(patchCall).toBeTruthy();
});

// ── BottomNav Tests ──────────────────────────────

// T4: Gold dot renders when unreadCheckIn=true (lives on Profile — the
// Program tab left the bar when the nav aligned with mobile's 5-slot layout)
test('T4: gold dot renders on Profile tab when unreadCheckIn=true', () => {
  const { container } = render(<BottomNav unreadCheckIn={true} />);
  const goldDot = container.querySelector('[role="presentation"]');
  expect(goldDot).toBeTruthy();
  // Button should have accessible label including unread status
  const profileBtn = container.querySelector('[aria-label="Profile (unread check-in)"]');
  expect(profileBtn).toBeTruthy();
});

// T5: Gold dot hidden when unreadCheckIn=false
test('T5: gold dot hidden when unreadCheckIn=false', () => {
  const { container } = render(<BottomNav unreadCheckIn={false} />);
  const goldDot = container.querySelector('[role="presentation"]');
  expect(goldDot).toBeNull();
  // Button should have plain label
  const profileBtn = container.querySelector('[aria-label="Profile"]');
  expect(profileBtn).toBeTruthy();
});

// T4b: nav exposes the mobile-aligned tab set — Home, Feed, FAB, Progress, Profile
test('T4b: BottomNav renders Home/Feed/Progress/Profile tabs and the workout FAB', () => {
  const { container } = render(<BottomNav />);
  expect(container.querySelector('[aria-label="Home"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Feed"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Progress"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Profile"]')).toBeTruthy();
  expect(container.querySelector('[aria-label="Today\'s workout"]')).toBeTruthy();
  // Old Program/Gym labeled tabs are gone from the bar
  expect(container.querySelector('[aria-label="Program"]')).toBeNull();
  expect(container.querySelector('[aria-label="Gym"]')).toBeNull();
});

// ── CheckInMessage Tests ─────────────────────────

// T6: CheckInMessage has `unread` class when isUnread
test('T6: CheckInMessage has unread class when isUnread=true', () => {
  const { container } = render(
    <CheckInMessage checkIn={makeCheckIn()} isUnread={true} />
  );
  const card = container.querySelector('.check-in-card');
  expect(card?.classList.contains('unread')).toBe(true);
});

// T7: `unread` class removed after 3s auto-read
test('T7: unread class removed after 3s auto-mark-read', () => {
  const onMarkRead = jest.fn();
  const { container } = render(
    <CheckInMessage checkIn={makeCheckIn()} isUnread={true} onMarkRead={onMarkRead} />
  );

  const card = container.querySelector('.check-in-card');
  expect(card?.classList.contains('unread')).toBe(true);
  expect(onMarkRead).not.toHaveBeenCalled();

  act(() => { jest.advanceTimersByTime(3000); });

  expect(card?.classList.contains('unread')).toBe(false);
  expect(onMarkRead).toHaveBeenCalledTimes(1);
});

// T8: NEW pill visible when isUnread
test('T8: NEW pill visible when isUnread=true', () => {
  const { container } = render(
    <CheckInMessage checkIn={makeCheckIn()} isUnread={true} />
  );
  const pill = container.querySelector('.new-pill');
  expect(pill).toBeTruthy();
  expect(pill?.textContent).toBe('NEW');
});

// T9: NEW pill fades after 5s
test('T9: NEW pill fades after 5s and hides at 5.5s', () => {
  const { container } = render(
    <CheckInMessage checkIn={makeCheckIn()} isUnread={true} />
  );

  let pill = container.querySelector('.new-pill');
  expect(pill).toBeTruthy();
  expect(pill?.classList.contains('new-pill--fading')).toBe(false);

  // After 5s — fading class added
  act(() => { jest.advanceTimersByTime(5000); });
  pill = container.querySelector('.new-pill');
  expect(pill?.classList.contains('new-pill--fading')).toBe(true);

  // After 5.5s total — pill gone
  act(() => { jest.advanceTimersByTime(500); });
  pill = container.querySelector('.new-pill');
  expect(pill).toBeNull();
});

// ── Sunday Anticipation Tests ────────────────────

// T10: isSundayAnticipation true on Sunday 5:30-6pm
test('T10: isSundayAnticipation true on Sunday 5:45pm PR time', () => {
  // 2026-03-29 is a Sunday. 5:45pm AST = 21:45 UTC (AST = UTC-4)
  const sundayEvening = new Date('2026-03-29T21:45:00Z');
  expect(isSundayAnticipation(sundayEvening)).toBe(true);
});

// T11: isSundayAnticipation false outside window
test('T11: isSundayAnticipation false on Monday', () => {
  const monday = new Date('2026-03-30T21:45:00Z');
  expect(isSundayAnticipation(monday)).toBe(false);
});

// T12: getMinutesUntilSixPM returns correct countdown
test('T12: getMinutesUntilSixPM returns correct countdown', () => {
  // 5:45pm AST on Sunday = 15 minutes until 6pm
  const sundayEvening = new Date('2026-03-29T21:45:00Z');
  expect(getMinutesUntilSixPM(sundayEvening)).toBe(15);
});
