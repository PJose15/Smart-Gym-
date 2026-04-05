import { isFeatureEnabled, clearFlagCache, needsRefresh, refreshFeatureFlags } from '../featureFlags';
import { supabase } from '../supabase';

const NOW = new Date('2025-06-15T10:00:00Z').getTime();

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
    // Simulate a populated cache by refreshing with mock data
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({
        data: [{ key: 'ai_assist', enabled: true, profile_id: null }],
        error: null,
      }),
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
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
    });

    await refreshFeatureFlags();
    expect(needsRefresh()).toBe(false);
  });

  test('returns true after 5 minutes', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
    });

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

  test('loads gym-level flags', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({
        data: [
          { key: 'ai_assist', enabled: true, profile_id: null },
          { key: 'social_feed', enabled: false, profile_id: null },
        ],
        error: null,
      }),
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(true);
    expect(isFeatureEnabled('social_feed')).toBe(false);
  });

  test('user-specific override beats gym-level', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({
        data: [
          { key: 'ai_assist', enabled: false, profile_id: null },
          { key: 'ai_assist', enabled: true, profile_id: 'user-1' },
        ],
        error: null,
      }),
    });

    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(true);
  });

  test('handles Supabase error gracefully', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'network error' },
      }),
    });

    // Should not throw
    await refreshFeatureFlags();
    expect(isFeatureEnabled('ai_assist')).toBe(false);
  });
});
