import { isFeatureEnabled, clearFlagCache, needsRefresh, refreshFeatureFlags } from '../featureFlags';
import { supabase } from '../supabase';

const NOW = new Date('2025-06-15T10:00:00Z').getTime();

/** Mock the deployed schema: .select('flag_key, is_enabled') resolves directly. */
function mockFlagsQuery(result: { data: unknown; error: unknown }) {
  (supabase.from as jest.Mock).mockReturnValueOnce({
    select: jest.fn().mockResolvedValueOnce(result),
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  clearFlagCache();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('isFeatureEnabled', () => {
  test('returns false for unknown flag', () => {
    expect(isFeatureEnabled('unknown-flag')).toBe(false);
  });

  test('returns false after clearFlagCache', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({
      data: [{ flag_key: 'ai_assist', is_enabled: true }],
      error: null,
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(true);

    clearFlagCache();
    expect(isFeatureEnabled('ai_assist')).toBe(false);
  });
});

describe('needsRefresh', () => {
  test('returns true initially (never fetched)', () => {
    expect(needsRefresh()).toBe(true);
  });

  test('returns false right after refresh', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({ data: [], error: null });

    await refreshFeatureFlags();
    expect(needsRefresh()).toBe(false);
  });

  test('returns true after 5 minutes', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({ data: [], error: null });

    await refreshFeatureFlags();
    jest.setSystemTime(NOW + 5 * 60 * 1000 + 1);
    expect(needsRefresh()).toBe(true);
  });
});

describe('refreshFeatureFlags', () => {
  test('does nothing when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('anything')).toBe(false);
  });

  test('loads global flags keyed by flag_key', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({
      data: [
        { flag_key: 'ai_assist', is_enabled: true },
        { flag_key: 'social_feed', is_enabled: false },
      ],
      error: null,
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(true);
    expect(isFeatureEnabled('social_feed')).toBe(false);
  });

  test('last row wins for duplicate flag keys', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({
      data: [
        { flag_key: 'ai_assist', is_enabled: false },
        { flag_key: 'ai_assist', is_enabled: true },
      ],
      error: null,
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(true);
  });

  test('handles Supabase error gracefully', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockFlagsQuery({ data: null, error: { message: 'network error' } });

    // Should not throw
    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(false);
  });
});
