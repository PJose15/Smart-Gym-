/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import ProfilePage from '../page';

// ── Mocks ──────────────────────────────────────────

jest.mock('@/lib/contexts/MemberContext', () => ({
  useMember: jest.fn(),
}));

jest.mock('@/components/ui/MemberAvatar', () => ({
  MemberAvatar: ({ name }: { name: string }) => <div data-testid="member-avatar">{name}</div>,
}));

// ── Helpers ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
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

const mockProfileData = {
  member: {
    id: 'm-1',
    display_name: 'Test User',
    first_name: 'Test',
    avatar_url: null,
    primary_goal: 'muscle-building',
    experience_level: 'intermediate',
    joined_gym_at: '2025-01-15T00:00:00Z',
  },
  level: {
    current: { level: 5, name: 'Silver', color: '#C0C0C0', minPts: 400, maxPts: 600 },
    next: { level: 6, name: 'Gold', color: '#FFD700', minPts: 600, maxPts: 900 },
    totalPoints: 500,
    progressPct: 50,
    pointsToNext: 100,
  },
  stats: {
    total_workouts: 42,
    total_volume_lbs: 125000,
    total_sets: 310,
    total_duration_min: 1850,
    avg_workouts_per_week: 3.5,
  },
  streak: { current: 8, best: 14 },
  achievements: [
    { code: 'first_workout', title: 'First Workout', description: 'Complete your first workout', category: 'milestone', icon_name: null, points: 10, earned_at: '2025-01-20T00:00:00Z' },
    { code: 'streak_7', title: '7-Day Streak', description: 'Train 7 days in a row', category: 'streak', icon_name: null, points: 25, earned_at: '2025-02-10T00:00:00Z' },
    { code: 'volume_100k', title: '100K Club', description: 'Lift 100K total volume', category: 'volume', icon_name: null, points: 50, earned_at: '2025-03-01T00:00:00Z' },
  ],
  favorite_machines: [
    { id: 'fm-1', name: 'Bench Press', sessions: 18 },
    { id: 'fm-2', name: 'Squat Rack', sessions: 14 },
    { id: 'fm-3', name: 'Lat Pulldown', sessions: 10 },
  ],
};

const mockDnaData = {
  dna: {
    archetype: { name: 'Power Builder', color: '#FF6B35' },
    is_building: false,
    dimensions: {},
  },
};

function mockFetchSuccess() {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfileData,
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockDnaData,
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

// T1: Shows skeleton while loading (memberLoading=true)
test('T1: shows skeleton while member is loading', () => {
  mockUseMember.mockReturnValue({ member: null, gym: null, weightUnit: 'lbs', loading: true });

  const { container } = render(<ProfilePage />);

  // Skeleton has circular placeholder (80x80 avatar placeholder)
  const skeletonCircle = container.querySelector('div[style*="border-radius: 50%"]');
  expect(skeletonCircle).toBeTruthy();
  // No actual member name should be present
  expect(container.textContent).not.toContain('Test User');
});

// T2: Shows "Not signed in" when no member
test('T2: shows "Not signed in" when no member', () => {
  mockUseMember.mockReturnValue({ member: null, gym: null, weightUnit: 'lbs', loading: false });

  const { container } = render(<ProfilePage />);

  expect(container.textContent).toContain('Not signed in');
});

// T3: Renders member name and avatar after fetch
test('T3: renders member name and avatar after fetch', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  expect(result!.getByTestId('member-avatar').textContent).toBe('Test User');
  expect(result!.container.textContent).toContain('Test User');
});

// T4: Renders level badge with correct name and color
test('T4: renders level badge with correct name and color', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  expect(result!.container.textContent).toContain('Silver');
  expect(result!.container.textContent).toContain('Lv.5');
  // Level name rendered in the correct color
  const levelName = Array.from(result!.container.querySelectorAll('span')).find(
    (el) => el.textContent === 'Silver'
  );
  expect(levelName).toBeTruthy();
  expect(levelName!.style.color).toBe('rgb(192, 192, 192)');
});

// T5: Renders XP progress bar with correct width%
test('T5: renders XP progress bar with correct width%', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  const progressBar = result!.container.querySelector('div[style*="width: 50%"]');
  expect(progressBar).toBeTruthy();
  expect(result!.container.textContent).toContain('100 pts to Gold');
});

// T6: Renders lifetime stats grid (workouts, volume, sets, time)
test('T6: renders lifetime stats grid', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('42');
  expect(text).toContain('125.0k lbs');
  expect(text).toContain('310');
  expect(text).toContain('30h 50m');
  expect(text).toContain('Workouts');
  expect(text).toContain('Volume');
  expect(text).toContain('Total Sets');
  expect(text).toContain('Time');
});

// T7: Renders streak card with current and best
test('T7: renders streak card with current and best', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('8d');
  expect(text).toContain('14d');
  expect(text).toContain('Current');
  expect(text).toContain('Best');
});

// T8: Renders favorite machines list
test('T8: renders favorite machines list', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('Favorite Machines');
  expect(text).toContain('Bench Press');
  expect(text).toContain('18 sessions');
  expect(text).toContain('Squat Rack');
  expect(text).toContain('14 sessions');
  expect(text).toContain('#1');
  expect(text).toContain('#2');
});

// T9: Renders achievements/badges grid
test('T9: renders achievements grid', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('Badges');
  expect(text).toContain('3 Unlocked');
  expect(text).toContain('First Workout');
  expect(text).toContain('7-Day Streak');
  expect(text).toContain('100K Club');
});

// T10: Shows "Member since" footer with formatted date
test('T10: shows "Member since" footer with formatted date', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  mockFetchSuccess();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  expect(result!.container.textContent).toContain('Member since January 2025');
});

// T11: Shows error state and retry button on fetch failure
test('T11: shows error state and retry button on fetch failure', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');
  const retryBtn = result!.container.querySelector('button');
  expect(retryBtn).toBeTruthy();
  expect(retryBtn!.textContent).toBe('Retry');
});

// T12: Retry button refetches data
test('T12: retry button refetches data successfully', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, weightUnit: 'lbs', loading: false });
  // First fetch fails
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProfilePage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');

  // Retry succeeds
  mockFetchSuccess();

  await act(async () => {
    fireEvent.click(result!.container.querySelector('button')!);
  });

  expect(result!.container.textContent).toContain('Test User');
  expect(result!.container.textContent).not.toContain('Something went wrong');
});
