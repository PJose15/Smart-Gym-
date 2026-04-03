/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import ProgramPage from '../page';

// ── Mocks ──────────────────────────────────────────

jest.mock('@/lib/contexts/MemberContext', () => ({
  useMember: jest.fn(),
}));

jest.mock('@/components/skeleton', () => ({
  SkeletonGate: ({ loading, skeleton, children }: any) =>
    loading ? skeleton : <>{children}</>,
}));

jest.mock('../components/ProgramPageSkeleton', () => ({
  ProgramPageSkeleton: () => <div data-testid="program-skeleton">skeleton</div>,
}));

jest.mock('../components/EmptyProgramState', () => ({
  EmptyProgramState: () => <div data-testid="empty-program">No Active Program</div>,
}));

jest.mock('../components/ProgramHeader', () => ({
  ProgramHeader: (props: any) => (
    <div data-testid="program-header">
      <span>{props.title}</span>
      <span>{props.description}</span>
      <span>{props.generatedBy === 'ai' ? 'AI-Generated' : `Built by ${props.trainerName || 'Trainer'}`}</span>
      {props.trainerApproved && <span>Trainer Approved</span>}
      <div
        role="progressbar"
        aria-valuenow={props.sessionsTotal > 0 ? Math.round((props.sessionsCompleted / props.sessionsTotal) * 100) : 0}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <span>{props.sessionsCompleted} / {props.sessionsTotal} sessions</span>
    </div>
  ),
}));

jest.mock('../components/DayCard', () => ({
  DayCard: ({ day, isToday }: any) => (
    <div data-testid={`day-card-${day.day_number}`}>
      <span>{day.name}</span>
      {isToday && <span>Today</span>}
      {day.exercises.map((ex: any, i: number) => (
        <span key={i}>{ex.exercise_name} — {ex.default_sets} × {ex.default_reps}</span>
      ))}
      {day.exercises.length === 0 && <span>No exercises assigned</span>}
    </div>
  ),
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

const mockProgramData = {
  program: {
    id: 'p-1',
    title: 'Hypertrophy Phase A',
    description: 'Upper/lower split targeting hypertrophy',
    goal: 'muscle-building',
    duration_weeks: 8,
    sessions_per_week: 3,
    week_number: 2,
    day_number: 1,
    sessions_completed: 4,
    sessions_total: 12,
    on_track: true,
    program_data: {
      days: [
        {
          day_number: 1,
          name: 'Push Day',
          exercises: [
            { exercise_name: 'Bench Press', default_sets: 4, default_reps: 8 },
            { exercise_name: 'Overhead Press', default_sets: 3, default_reps: 10 },
          ],
        },
        {
          day_number: 2,
          name: 'Pull Day',
          exercises: [
            { exercise_name: 'Barbell Row', default_sets: 4, default_reps: 8 },
            { exercise_name: 'Lat Pulldown', default_sets: 3, default_reps: 12 },
          ],
        },
        {
          day_number: 3,
          name: 'Leg Day',
          exercises: [],
        },
      ],
    },
    generated_by: 'ai',
    trainer_approved: false,
    trainer_name: null as string | null,
    created_at: '2025-03-01T00:00:00Z',
  },
};

function mockFetchProgram(data = mockProgramData) {
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

// T1: Shows skeleton while loading (memberLoading → SkeletonGate renders skeleton)
test('T1: shows skeleton while member is loading', () => {
  mockUseMember.mockReturnValue({ member: null, gym: null, loading: true });

  const { container } = render(<ProgramPage />);

  // SkeletonGate receives loading=true because member is null so fetch hasn't run
  // The page's own loading starts true, so skeleton is shown
  expect(container.textContent).not.toContain('Hypertrophy Phase A');
});

// T2: Shows empty state when program=null
test('T2: shows EmptyProgramState when program is null', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ program: null }),
  });

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('No Active Program');
});

// T3: Program title + description render
test('T3: renders program title and description', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('Hypertrophy Phase A');
  expect(result!.container.textContent).toContain('Upper/lower split targeting hypertrophy');
});

// T4: AI-Generated badge
test('T4: shows AI-Generated badge when generated_by is ai', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('AI-Generated');
});

// T5: Trainer badge
test('T5: shows trainer badge when generated_by is trainer', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  const trainerProgram = {
    program: {
      ...mockProgramData.program,
      generated_by: 'trainer',
      trainer_name: 'Coach Smith',
    },
  };
  mockFetchProgram(trainerProgram);

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('Built by Coach Smith');
});

// T6: Trainer Approved badge
test('T6: shows Trainer Approved badge when trainer_approved is true', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  const approvedProgram = {
    program: {
      ...mockProgramData.program,
      trainer_approved: true,
    },
  };
  mockFetchProgram(approvedProgram);

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('Trainer Approved');
});

// T7: Progress bar percentage
test('T7: renders progress bar with correct percentage', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  const progressBar = result!.container.querySelector('[role="progressbar"]');
  expect(progressBar).toBeTruthy();
  expect(progressBar!.getAttribute('aria-valuenow')).toBe('33');
  expect(result!.container.textContent).toContain('4 / 12 sessions');
});

// T8: Day cards with exercises
test('T8: renders day cards with exercises', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  const text = result!.container.textContent!;
  expect(text).toContain('Push Day');
  expect(text).toContain('Bench Press');
  expect(text).toContain('4 × 8');
});

// T9: Today badge on correct day
test('T9: shows Today badge on correct day', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  // day_number=1, sessions_per_week=3 → todayIdx = ((1-1)%3+3)%3 = 0, so Day 1 (Push Day) is today
  expect(result!.container.textContent).toContain('Today');
});

// T10: Empty exercises message
test('T10: shows "No exercises assigned" for empty day', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  mockFetchProgram();

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('No exercises assigned');
});

// T11: Error state + retry button
test('T11: shows error state and retry button on fetch failure', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');
  const retryBtn = result!.container.querySelector('button');
  expect(retryBtn).toBeTruthy();
  expect(retryBtn!.textContent).toBe('Retry');
});

// T12: Retry refetches successfully
test('T12: retry button refetches data successfully', async () => {
  mockUseMember.mockReturnValue({ member: mockMember, gym: null, loading: false });
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<ProgramPage />);
  });

  expect(result!.container.textContent).toContain('Something went wrong');

  // Retry succeeds
  mockFetchProgram();

  await act(async () => {
    fireEvent.click(result!.container.querySelector('button')!);
  });

  expect(result!.container.textContent).toContain('Hypertrophy Phase A');
  expect(result!.container.textContent).not.toContain('Something went wrong');
});
