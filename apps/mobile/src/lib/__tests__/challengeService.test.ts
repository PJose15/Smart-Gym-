/**
 * Tests for the challenge service — Supabase reads and API-route join.
 *
 * Follows the feedService pattern: mock Supabase at the module level and
 * override resolved values per test. Global mock is in jest.setup.js; we
 * re-import supabase to access the mock and configure per-test responses.
 */
import { supabase } from '../supabase';
import {
  fetchChallenges,
  fetchChallengeDetail,
  joinChallenge,
  CHALLENGES_CACHE_KEY,
  CHALLENGE_DETAIL_CACHE_KEY,
} from '../challengeService';

// ─── Types ───────────────────────────────────────────────────────────────────

import type { ChallengeListItem } from '@nexera/types';

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

// ─── Cache key helpers ────────────────────────────────────────────────────────

describe('cache key helpers', () => {
  it('CHALLENGES_CACHE_KEY produces the expected key string', () => {
    expect(CHALLENGES_CACHE_KEY('gym-1')).toBe('challenges:gym-1');
  });

  it('CHALLENGE_DETAIL_CACHE_KEY produces the expected key string', () => {
    expect(CHALLENGE_DETAIL_CACHE_KEY('chal-1')).toBe('challenge:chal-1');
  });
});

// ─── fetchChallenges ──────────────────────────────────────────────────────────

describe('fetchChallenges', () => {
  const gymId = 'gym-abc';
  const memberId = 'mem-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ChallengeListItem[] with is_joined and my_score from own participation', async () => {
    const challengeRows = [
      {
        id: 'chal-1',
        title: 'Volume King',
        description: 'Lift the most',
        challenge_type: 'volume',
        start_date: '2026-07-01T00:00:00Z',
        end_date: '2026-07-31T23:59:59Z',
        is_active: true,
        top_score: 10000,
        created_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'chal-2',
        title: 'Streak Master',
        description: 'Hit 30 days',
        challenge_type: 'streak',
        start_date: '2026-07-01T00:00:00Z',
        end_date: '2026-07-31T23:59:59Z',
        is_active: false,
        top_score: 30,
        created_at: '2026-07-01T00:00:00Z',
      },
    ];

    const participationRows = [
      { challenge_id: 'chal-1', current_score: 5000, current_rank: 2 },
    ];

    const participantCountRows = [
      { challenge_id: 'chal-1' },
      { challenge_id: 'chal-1' },
      { challenge_id: 'chal-1' },
      { challenge_id: 'chal-2' },
    ];

    // Set up sequential mock calls:
    // call 1: gym_challenges list
    // call 2: challenge_participants own rows
    // call 3: challenge_participants counts
    let callCount = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSupabaseMock({ data: challengeRows, error: null });
      }
      if (callCount === 2) {
        return makeSupabaseMock({ data: participationRows, error: null });
      }
      // call 3+: participant count rows
      return makeSupabaseMock({ data: participantCountRows, error: null });
    });

    const result = await fetchChallenges(gymId, memberId);

    expect(result).toHaveLength(2);

    const chal1 = result.find((c: ChallengeListItem) => c.challenge_id === 'chal-1');
    expect(chal1).toBeDefined();
    expect(chal1!.is_joined).toBe(true);
    expect(chal1!.my_score).toBe(5000);
    expect(chal1!.rank).toBe(2);

    const chal2 = result.find((c: ChallengeListItem) => c.challenge_id === 'chal-2');
    expect(chal2).toBeDefined();
    expect(chal2!.is_joined).toBe(false);
    expect(chal2!.my_score).toBeNull();
  });

  it('throws on Supabase error', async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: null, error: { message: 'DB error', code: '500' } }),
    );

    await expect(fetchChallenges(gymId, memberId)).rejects.toBeTruthy();
  });

  it('returns empty array when no challenges exist', async () => {
    let callCount = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSupabaseMock({ data: [], error: null });
      return makeSupabaseMock({ data: [], error: null });
    });

    const result = await fetchChallenges(gymId, memberId);
    expect(result).toHaveLength(0);
  });
});

// ─── fetchChallengeDetail ─────────────────────────────────────────────────────

describe('fetchChallengeDetail', () => {
  const challengeId = 'chal-123';
  const memberId = 'mem-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for missing (deleted/stale) challenge — NOT a throw', async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: null, error: null }),
    );

    const result = await fetchChallengeDetail(challengeId, memberId);
    expect(result).toBeNull();
  });

  it('throws when the gym_challenges query resolves with an error (network/RLS failure)', async () => {
    const supaError = { message: 'network failure', code: 'PGRST000' };
    (mockSupabase.from as jest.Mock).mockReturnValue(
      makeSupabaseMock({ data: null, error: supaError }),
    );

    await expect(fetchChallengeDetail(challengeId, memberId)).rejects.toEqual(supaError);
  });

  it('returns ChallengeDetail with participants and my_participation resolved', async () => {
    const challengeRow = {
      id: challengeId,
      title: 'Volume King',
      description: 'Lift the most',
      challenge_type: 'volume',
      start_date: '2026-07-01T00:00:00Z',
      end_date: '2026-07-31T23:59:59Z',
      is_active: true,
      top_score: 10000,
      entry_mode: 'open',
      prize_type: null,
      prize_description: null,
      created_at: '2026-07-01T00:00:00Z',
    };

    const participantRows = [
      { member_id: memberId, current_score: 5000, current_rank: 1, joined_at: '2026-07-02T00:00:00Z' },
      { member_id: 'mem-other', current_score: 3000, current_rank: 2, joined_at: '2026-07-03T00:00:00Z' },
    ];

    const memberRows = [
      { id: memberId, profile_id: 'prof-me' },
      { id: 'mem-other', profile_id: 'prof-other' },
    ];

    const profileRows = [
      { id: 'prof-me', full_name: 'Alice', avatar_url: null },
      { id: 'prof-other', full_name: 'Bob', avatar_url: null },
    ];

    let callCount = 0;
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      callCount++;
      if (table === 'gym_challenges') {
        return makeSupabaseMock({ data: challengeRow, error: null });
      }
      if (table === 'challenge_participants') {
        return makeSupabaseMock({ data: participantRows, error: null });
      }
      if (table === 'gym_members') {
        return makeSupabaseMock({ data: memberRows, error: null });
      }
      if (table === 'profiles') {
        return makeSupabaseMock({ data: profileRows, error: null });
      }
      return makeSupabaseMock({ data: null, error: null });
    });

    const result = await fetchChallengeDetail(challengeId, memberId);

    expect(result).not.toBeNull();
    expect(result!.challenge_id).toBe(challengeId);
    expect(result!.participants).toHaveLength(2);

    // my_participation should be the current member's participant row
    expect(result!.my_participation).not.toBeNull();
    expect(result!.my_participation!.member_id).toBe(memberId);
  });

  it('sets my_participation to null when member is not a participant', async () => {
    const challengeRow = {
      id: challengeId,
      title: 'Test',
      description: null,
      challenge_type: 'sessions',
      start_date: '2026-07-01T00:00:00Z',
      end_date: '2026-07-31T23:59:59Z',
      is_active: true,
      top_score: 20,
      entry_mode: 'open',
      prize_type: null,
      prize_description: null,
      created_at: '2026-07-01T00:00:00Z',
    };

    const otherMemberId = 'mem-other';
    const participantRows = [
      { member_id: otherMemberId, current_score: 10, current_rank: 1, joined_at: '2026-07-01T00:00:00Z' },
    ];

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'gym_challenges') return makeSupabaseMock({ data: challengeRow, error: null });
      if (table === 'challenge_participants') return makeSupabaseMock({ data: participantRows, error: null });
      if (table === 'gym_members') return makeSupabaseMock({ data: [{ id: otherMemberId, profile_id: 'prof-other' }], error: null });
      if (table === 'profiles') return makeSupabaseMock({ data: [{ id: 'prof-other', full_name: 'Bob', avatar_url: null }], error: null });
      return makeSupabaseMock({ data: null, error: null });
    });

    const result = await fetchChallengeDetail(challengeId, memberId);

    expect(result).not.toBeNull();
    expect(result!.my_participation).toBeNull();
  });
});

// ─── joinChallenge ────────────────────────────────────────────────────────────

describe('joinChallenge', () => {
  const challengeId = 'chal-123';
  const memberId = 'mem-xyz';
  const gymId = 'gym-abc';

  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.test.nexera.app';
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "error" without fetching when EXPO_PUBLIC_API_URL is missing', async () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'tok-abc' } },
        error: null,
      });
      global.fetch = jest.fn();

      const result = await joinChallenge(challengeId, memberId, gymId);
      expect(result).toBe('error');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      process.env.EXPO_PUBLIC_API_URL = saved;
      warnSpy.mockRestore();
    }
  });

  it('returns "joined" on 201 response', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({ status: 201, ok: true });

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('joined');
  });

  it('returns "already_joined" on 409 response', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({ status: 409, ok: false });

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('already_joined');
  });

  it('returns "ended" on 400 response', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({ status: 400, ok: false });

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('ended');
  });

  it('returns "error" on unexpected status code', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({ status: 500, ok: false });

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('error');
  });

  it('returns "error" on network throw', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
      error: null,
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('error');
  });

  it('returns "error" when no session token is available (no fetch)', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    global.fetch = jest.fn();

    const result = await joinChallenge(challengeId, memberId, gymId);
    expect(result).toBe('error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends Authorization Bearer header with access token', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'my-token-123' } },
      error: null,
    });

    global.fetch = jest.fn().mockResolvedValue({ status: 201, ok: true });

    await joinChallenge(challengeId, memberId, gymId);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token-123');
  });
});
