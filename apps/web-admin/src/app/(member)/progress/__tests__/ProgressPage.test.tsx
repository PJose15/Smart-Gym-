/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import ProgressPage from '../page';

// ── Mocks ──────────────────────────────────────────

jest.mock('@/lib/contexts/MemberContext', () => ({
  useMember: jest.fn(),
}));

// ── Helpers ────────────────────────────────────────

const mockUseMember = require('@/lib/contexts/MemberContext').useMember;

const mockMember = {
  id: 'm-1',
  user_id: 'u-1',
  display_name: 'Test User',
  first_name: 'Test',
  avatar_url: null,
  phone: null,
  smartgym_score: 500,
  current_streak: 8,
  primary_goal: 'muscle-building',
  experience_level: 'intermediate',
  gym_id: 'g-1',
};

function makeWeeklyVolume(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    week: `W${i + 1}`,
    volume: (i + 1) * 1000,
  }));
}

// Generate recent workout dates (some active)
function makeWorkoutDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  // 5 active days in the last 30
  for (const offset of [0, 2, 5, 10, 15]) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const mockProgressData = {
  stats: {
    total_workouts: 42,
    total_volume_lbs: 125000,
    total_sets: 310,
    avg_per_week: 3.5,
    current_streak: 8,
  },
  weekly_volume: makeWeeklyVolume(8),
  workout_dates: makeWorkoutDates(),
  personal_records: [
    { machine_name: 'Bench Press', weight_lbs: 225, reps: 5, date: '2026-03-20', est_1rm: 253 },
    { machine_name: 'Squat', weight_lbs: 315, reps: 3, date: '2026-03-18', est_1rm: 334 },
  ],
  recent_workouts: [
    { id: 'w1', date: '2026-03-25', machine_name: 'Bench Press', volume_lbs: 5000, sets: 4, duration_min: 45 },
    { id: 'w2', date: '2026-03-23', machine_name: 'Squat Rack', volume_lbs: 7500, sets: 5, duration_min: 55 },
  ],
};

function mockFetchSuccess(data = mockProgressData) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
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

// T1: Shows skeleton while loading
test('T1: shows skeleton while member is loading', () => {
  mockUseMember.mockReturnValue({ member: null, gym: null, weightUnit: 'lbs', loading: true });

  const { container } = render(<ProgressPage />);

  // Skeleton has placeholder divs
  const skeletonBlocks = container.querySelectorAll('div[style*="background-color: var(--color-surface-secondary"]');
  expect(skeletonBlocks.length).toBeGreaterThan(0);
  // No actual data
  expect(container.textContent).not.toContain('Progress');
});

// T2: Shows "Not signed in" when no member
test('T2: shows "Not signed in" when no member', () => {
  mockUseMember.mockReturnValue({ member: null, gym: null, weightUnit: 'lbs', loading: false });

  const { container } = render(<ProgressPage />);

  expect(container.textContent).toContain('Not signed in');
});

// T3: Renders stats overview (workouts, volume, avg/week, streak)
test('T3: renders stats overview cards', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('42');
  expect(text).toContain('125.0k lbs');
  expect(text).toContain('3.5');
  expect(text).toContain('8d');
  expect(text).toContain('Workouts');
  expect(text).toContain('Volume');
  expect(text).toContain('Avg / Week');
  expect(text).toContain('Streak');
});

// T4: Renders volume chart bars (8 bars)
test('T4: renders volume chart with 8 bars', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  expect(result!.container.textContent).toContain('Weekly Volume');
  // 8 week labels
  for (let i = 1; i <= 8; i++) {
    expect(result!.container.textContent).toContain(`W${i}`);
  }
});

// T5: Highlights last bar in blue
test('T5: highlights last volume bar in blue', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  // The volume chart section: find bars inside the chart (height-based bars)
  // The last bar (W8) should have blue; others have surface-secondary
  // Query all bars within the flex container that has alignItems: flex-end (the chart area)
  const chartContainer = Array.from(result!.container.querySelectorAll('div')).find(
    (el) => el.style.alignItems === 'flex-end' && el.style.height === '100px'
  );
  expect(chartContainer).toBeTruthy();
  const bars = chartContainer!.querySelectorAll('div[style*="border-radius: 4"]');
  expect(bars.length).toBe(8);
  // Last bar is blue
  expect((bars[7] as HTMLElement).style.backgroundColor).toBe('var(--color-blue, #60A5FA)');
  // First bar is not blue
  expect((bars[0] as HTMLElement).style.backgroundColor).toBe('var(--color-surface-secondary, #2a2a3e)');
});

// T6: Renders 30-day calendar dots
test('T6: renders 30-day calendar with dots', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  expect(result!.container.textContent).toContain('Last 30 Days');
  // 30 calendar day dots (each has width: 28)
  const dayDots = result!.container.querySelectorAll('div[title]');
  expect(dayDots.length).toBe(30);
});

// T7: Active calendar days have blue background
test('T7: active calendar days have blue background', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  // 5 active workout dates in our mock
  const activeDots = result!.container.querySelectorAll('div[style*="background-color: var(--color-blue"]');
  // At least the calendar active ones (could also match the volume chart bar)
  expect(activeDots.length).toBeGreaterThanOrEqual(5);
});

// T8: Renders personal records list with est. 1RM
test('T8: renders personal records with est 1RM', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('Personal Records');
  expect(text).toContain('Bench Press');
  expect(text).toContain('225 lbs x 5');
  expect(text).toContain('253');
  expect(text).toContain('Squat');
  expect(text).toContain('315 lbs x 3');
  expect(text).toContain('334');
  expect(text).toContain('Est. 1RM');
});

// T9: Renders recent workouts with date and sets
test('T9: renders recent workouts with date and sets', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('Recent Workouts');
  expect(text).toContain('4 sets');
  expect(text).toContain('5 sets');
  expect(text).toContain('45m');
  expect(text).toContain('55m');
});

// T10: Shows error state and retry button
test('T10: shows error state and retry button on fetch failure', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');
  const retryBtn = result!.container.querySelector('button');
  expect(retryBtn).toBeTruthy();
  expect(retryBtn!.textContent).toBe('Retry');
});

// T11: Retry button refetches data
test('T11: retry button refetches data successfully', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');

  // Retry succeeds
  mockFetchSuccess();

  await act(async () => {
    fireEvent.click(result!.container.querySelector('button')!);
  });

  expect(result!.container.textContent).toContain('Progress');
  expect(result!.container.textContent).not.toContain('Something went wrong');
});

// T12: Hides PR section when no personal records
test('T12: hides PR section when no personal records', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess({ ...mockProgressData, personal_records: [] });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgressPage />);
  });

  expect(result!.container.textContent).not.toContain('Personal Records');
  expect(result!.container.textContent).not.toContain('Est. 1RM');
  // Other sections still render
  expect(result!.container.textContent).toContain('Progress');
  expect(result!.container.textContent).toContain('Weekly Volume');
});
