import { detectWorkoutMode } from '../workoutMode';
import { supabase } from '../supabase';

// Mock @nexera/utils
jest.mock('@nexera/utils', () => ({
  getTodaysProgramDay: jest.fn().mockReturnValue(2),
}));

const NOW = new Date('2025-06-15T10:00:00Z').getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Helper: mock for getMemberId — supabase.from('members').select('id').eq(...).limit(1).maybeSingle() */
function mockMemberId(memberId: string | null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: memberId ? { id: memberId } : null }),
  };
  return chain;
}

/** Helper: set up the mock chain for supabase.from(...).select(...).eq(...).eq(...).limit(...).maybeSingle() */
function mockAssignment(data: any) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data }),
  };
  return chain;
}

function mockProgram(data: any) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data }),
  };
  return chain;
}

function mockList(data: any) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data }),
  };
  return chain;
}

describe('detectWorkoutMode', () => {
  test('returns freestyle when no member found', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce(mockMemberId(null));

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('freestyle');
    expect(result.programId).toBeUndefined();
  });

  test('returns freestyle when no assignment', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment(null));

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('freestyle');
    expect(result.programId).toBeUndefined();
  });

  test('returns freestyle when program not found', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment({
        program_id: 'prog-1',
        assigned_at: '2025-06-01T00:00:00Z',
        ai_program_id: 'ai-1',
      }))
      .mockReturnValueOnce(mockProgram(null));

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('freestyle');
  });

  test('returns ai-program when assignment has ai_program_id', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment({
        program_id: 'prog-1',
        assigned_at: '2025-06-01T00:00:00Z',
        ai_program_id: 'ai-1',
      }))
      .mockReturnValueOnce(mockProgram({
        id: 'prog-1',
        name: 'AI Strength',
        created_by: null,
      }))
      // program_days
      .mockReturnValueOnce(mockList([]))
    ;

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('ai-program');
    expect(result.programTitle).toBe('AI Strength');
    expect(result.trainerName).toBeUndefined();
  });

  test('returns trainer-program when assignment has no ai_program_id', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment({
        program_id: 'prog-1',
        assigned_at: '2025-06-01T00:00:00Z',
        ai_program_id: null,
      }))
      .mockReturnValueOnce(mockProgram({
        id: 'prog-1',
        name: 'Custom Plan',
        created_by: 'trainer-1',
      }))
      // trainer profile
      .mockReturnValueOnce(mockProgram({ full_name: 'Coach Mike' }))
      // program_days
      .mockReturnValueOnce(mockList([]))
    ;

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('trainer-program');
    expect(result.trainerName).toBe('Coach Mike');
  });

  test('returns todayDay with exercises when days exist', async () => {
    const assignedAt = '2025-06-01T00:00:00Z';

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment({
        program_id: 'prog-1',
        assigned_at: assignedAt,
        ai_program_id: 'ai-1',
      }))
      .mockReturnValueOnce(mockProgram({
        id: 'prog-1',
        name: 'Hypertrophy',
        created_by: null,
      }))
      // program_days
      .mockReturnValueOnce(mockList([
        { id: 'day-1', day_number: 1, name: 'Push' },
        { id: 'day-2', day_number: 2, name: 'Pull' },
        { id: 'day-3', day_number: 3, name: 'Legs' },
      ]))
      // program_exercises for today's day
      .mockReturnValueOnce(mockList([
        { id: 'ex-1', exercise_name: 'Barbell Row', default_sets: 4, default_reps: 8, machine_id: null, order_index: 1 },
      ]))
    ;

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('ai-program');
    expect(result.todayDay).toBeDefined();
    expect(result.todayDay!.dayName).toBe('Pull'); // day_number 2 from getTodaysProgramDay mock
    expect(result.todayDay!.exercises).toHaveLength(1);
    expect(result.todayDay!.exercises[0].exercise_name).toBe('Barbell Row');
    expect(result.weekNumber).toBeGreaterThan(0);
  });

  test('returns no todayDay when days array is empty', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockMemberId('member-1'))
      .mockReturnValueOnce(mockAssignment({
        program_id: 'prog-1',
        assigned_at: '2025-06-01T00:00:00Z',
        ai_program_id: 'ai-1',
      }))
      .mockReturnValueOnce(mockProgram({
        id: 'prog-1',
        name: 'Quick Start',
        created_by: null,
      }))
      .mockReturnValueOnce(mockList([]))
    ;

    const result = await detectWorkoutMode('user-1');
    expect(result.mode).toBe('ai-program');
    expect(result.todayDay).toBeUndefined();
    expect(result.programTitle).toBe('Quick Start');
  });
});
