/**
 * Tests for the program service — Supabase reads for ai_programs + trainer lookup.
 *
 * Follows the challengeService.test.ts pattern: mock Supabase at the module level
 * and override resolved values per test. Global mock is in jest.setup.js; we
 * re-import supabase to access the mock and configure per-test responses.
 */
import { supabase } from '../supabase';
import {
  fetchProgram,
  PROGRAM_CACHE_KEY,
} from '../programService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a chainable Supabase mock that resolves to `resolvedValue` at the end
 * of any chain (single(), maybeSingle(), or plain await).
 * Every builder method returns `this` to allow unlimited chaining.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSupabaseMock(resolvedValue: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: Record<string, any> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'or', 'in', 'gte', 'lte', 'lt', 'gt', 'order', 'limit',
  ];

  // All chain methods return the mock itself
  for (const method of chainMethods) {
    mock[method] = jest.fn().mockReturnValue(mock);
  }

  // Terminal methods resolve to the value
  mock['single'] = jest.fn().mockResolvedValue(resolvedValue);
  mock['maybeSingle'] = jest.fn().mockResolvedValue(resolvedValue);

  // Allow plain `await` by making the object a thenable
  mock['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(resolve);

  return mock;
}

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_PROGRAM_ROW = {
  id: 'prog-1',
  title: 'Hypertrophy Block',
  description: 'Build muscle mass',
  goal: 'hypertrophy',
  duration_weeks: 8,
  sessions_per_week: 4,
  week_number: 2,
  day_number: 3,
  sessions_completed: 5,
  sessions_total: 32,
  on_track: true,
  program_data: {
    days: [
      {
        day_number: 1,
        name: 'Push Day',
        exercises: [
          { exercise_name: 'Bench Press', machine_id: 'mach-1', default_sets: 3, default_reps: 10 },
          { exercise_name: 'Overhead Press', machine_id: null, default_sets: 3, default_reps: 12 },
        ],
      },
      {
        day_number: 2,
        name: 'Pull Day',
        exercises: [
          { exercise_name: 'Barbell Row', machine_id: 'mach-2', default_sets: 4, default_reps: 8 },
        ],
      },
    ],
  },
  generated_by: 'gemini-pro',
  trainer_approved: false,
  trainer_approved_by: null,
  created_at: '2026-07-01T00:00:00.000Z',
};

// ─── cache key helper ─────────────────────────────────────────────────────────

describe('PROGRAM_CACHE_KEY', () => {
  it('produces "program:mem-1" for memberId "mem-1"', () => {
    expect(PROGRAM_CACHE_KEY('mem-1')).toBe('program:mem-1');
  });

  it('interpolates arbitrary member IDs', () => {
    expect(PROGRAM_CACHE_KEY('abc-def-123')).toBe('program:abc-def-123');
  });
});

// ─── fetchProgram ─────────────────────────────────────────────────────────────

describe('fetchProgram', () => {
  const memberId = 'mem-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when maybeSingle resolves { data: null } (no active program)', async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: null, error: null }),
    );

    const result = await fetchProgram(memberId);
    expect(result).toBeNull();
  });

  it('throws when the ai_programs query resolves with an error (network/RLS failure)', async () => {
    const supaError = { message: 'network failure', code: 'PGRST000' };
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: null, error: supaError }),
    );

    await expect(fetchProgram(memberId)).rejects.toEqual(supaError);
  });

  it('happy path (trainer_approved_by: null): maps all scalar fields, parses days, trainer_name is null', async () => {
    const programMock = makeSupabaseMock({ data: BASE_PROGRAM_ROW, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(programMock);

    const result = await fetchProgram(memberId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('prog-1');
    expect(result!.title).toBe('Hypertrophy Block');
    expect(result!.description).toBe('Build muscle mass');
    expect(result!.goal).toBe('hypertrophy');
    expect(result!.duration_weeks).toBe(8);
    expect(result!.sessions_per_week).toBe(4);
    expect(result!.week_number).toBe(2);
    expect(result!.day_number).toBe(3);
    expect(result!.sessions_completed).toBe(5);
    expect(result!.sessions_total).toBe(32);
    expect(result!.on_track).toBe(true);
    expect(result!.generated_by).toBe('gemini-pro');
    expect(result!.trainer_approved).toBe(false);
    expect(result!.trainer_name).toBeNull();
    expect(result!.created_at).toBe('2026-07-01T00:00:00.000Z');

    // Days parsed from program_data
    expect(result!.days).toHaveLength(2);
    expect(result!.days[0].day_number).toBe(1);
    expect(result!.days[0].name).toBe('Push Day');
    expect(result!.days[0].exercises).toHaveLength(2);
    expect(result!.days[0].exercises[0].exercise_name).toBe('Bench Press');
    expect(result!.days[0].exercises[0].default_sets).toBe(3);
    expect(result!.days[0].exercises[0].default_reps).toBe(10);
  });

  it('happy path: only one supabase.from call when trainer_approved_by is null', async () => {
    const programMock = makeSupabaseMock({ data: BASE_PROGRAM_ROW, error: null });
    const fromMock = jest.fn().mockReturnValue(programMock);
    (mockSupabase.from as jest.Mock) = fromMock;

    await fetchProgram(memberId);

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('ai_programs');
  });

  it('queries with .eq("member_id", ...), .eq("is_active", true), .order("created_at", ...), .limit(1)', async () => {
    const programMock = makeSupabaseMock({ data: null, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(programMock);

    await fetchProgram(memberId);

    expect(programMock.eq).toHaveBeenCalledWith('member_id', memberId);
    expect(programMock.eq).toHaveBeenCalledWith('is_active', true);
    expect(programMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(programMock.limit).toHaveBeenCalledWith(1);
  });

  it('with trainer_approved_by set: resolves trainer_name from users', async () => {
    const trainerProgram = {
      ...BASE_PROGRAM_ROW,
      trainer_approved: true,
      trainer_approved_by: 'user-trainer-1',
    };
    const programMock = makeSupabaseMock({ data: trainerProgram, error: null });
    const usersMock = makeSupabaseMock({ data: { display_name: 'Coach Sam' }, error: null });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'ai_programs') return programMock;
      if (table === 'users') return usersMock;
      return makeSupabaseMock({ data: null, error: null });
    });

    const result = await fetchProgram(memberId);

    expect(result).not.toBeNull();
    expect(result!.trainer_name).toBe('Coach Sam');
    expect(result!.trainer_approved).toBe(true);
  });

  it('with trainer_approved_by set but users lookup returns { data: null }: trainer_name is null, no throw', async () => {
    const trainerProgram = {
      ...BASE_PROGRAM_ROW,
      trainer_approved: true,
      trainer_approved_by: 'user-trainer-missing',
    };
    const programMock = makeSupabaseMock({ data: trainerProgram, error: null });
    const usersMock = makeSupabaseMock({ data: null, error: null });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'ai_programs') return programMock;
      if (table === 'users') return usersMock;
      return makeSupabaseMock({ data: null, error: null });
    });

    const result = await fetchProgram(memberId);

    expect(result).not.toBeNull();
    expect(result!.trainer_name).toBeNull();
  });

  it('with malformed program_data (null) → days: [], no throw', async () => {
    const malformedRow = { ...BASE_PROGRAM_ROW, program_data: null };
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: malformedRow, error: null }),
    );

    const result = await fetchProgram(memberId);

    expect(result).not.toBeNull();
    expect(result!.days).toEqual([]);
  });

  it('with malformed program_data ({} — no days key) → days: [], no throw', async () => {
    const malformedRow = { ...BASE_PROGRAM_ROW, program_data: {} };
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: malformedRow, error: null }),
    );

    const result = await fetchProgram(memberId);

    expect(result).not.toBeNull();
    expect(result!.days).toEqual([]);
  });
});
