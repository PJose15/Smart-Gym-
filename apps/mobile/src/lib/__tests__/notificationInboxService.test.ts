/**
 * Tests for notificationInboxService — fetchInbox and markRead.
 *
 * Follows challengeService.test.ts mock conventions:
 *  - Mock ../supabase at module level (global mock in jest.setup.js handles basic shape)
 *  - Configure auth per-test (getSession for Bearer JWT)
 *  - Mock global.fetch for API-route calls
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('../memberData', () => ({
  getMemberId: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { supabase } from '../supabase';
import { getMemberId } from '../memberData';
import { fetchInbox, markRead } from '../notificationInboxService';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockGetMemberId = getMemberId as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-abc-123';
const USER_ID = 'user-xyz-456';
const ACCESS_TOKEN = 'test-jwt-token';
const API_BASE = 'https://test.nexera.app';
const NOTIFICATION_1 = {
  id: 'notif-001',
  notification_type: 'pr_achieved',
  title: 'New PR!',
  body: 'You hit a new personal record.',
  data: { machine_id: 'mach-1' },
  read_at: null,
  created_at: '2026-07-20T10:00:00Z',
};
const NOTIFICATION_2 = {
  id: 'notif-002',
  notification_type: 'level_up',
  title: 'Level Up!',
  body: 'You reached level 5.',
  data: {},
  read_at: '2026-07-20T11:00:00Z',
  created_at: '2026-07-20T09:00:00Z',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated session with member resolved
  (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { access_token: ACCESS_TOKEN, user: { id: USER_ID } } },
    error: null,
  });
  mockGetMemberId.mockResolvedValue(MEMBER_ID);
  // Default env
  process.env.EXPO_PUBLIC_API_URL = API_BASE;
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

// ─── fetchInbox ───────────────────────────────────────────────────────────────

describe('fetchInbox', () => {
  it('returns typed InboxResult with notifications, unread_count, and next_cursor', async () => {
    const apiResponse = {
      notifications: [NOTIFICATION_1, NOTIFICATION_2],
      unread_count: 1,
      next_cursor: null,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(apiResponse),
    });

    const result = await fetchInbox();

    expect(result).not.toBeNull();
    expect(result!.notifications).toHaveLength(2);
    expect(result!.unread_count).toBe(1);
    expect(result!.next_cursor).toBeNull();
  });

  it('sends Bearer JWT in Authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ notifications: [], unread_count: 0, next_cursor: null }),
    });

    await fetchInbox();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('includes member_id as query param', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ notifications: [], unread_count: 0, next_cursor: null }),
    });

    await fetchInbox();

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`member_id=${MEMBER_ID}`);
  });

  it('includes cursor param when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ notifications: [], unread_count: 0, next_cursor: null }),
    });

    const cursor = '2026-07-19T12:00:00Z';
    await fetchInbox(cursor);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain('cursor=');
    expect(decodeURIComponent(url)).toContain(cursor);
  });

  it('returns null on 4xx API response (graceful, does not throw)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const result = await fetchInbox();
    expect(result).toBeNull();
  });

  it('returns null on 5xx API response (graceful, does not throw)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    const result = await fetchInbox();
    expect(result).toBeNull();
  });

  it('returns null on network throw (graceful, does not throw)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchInbox();
    expect(result).toBeNull();
  });

  it('returns null when session has no access_token', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    global.fetch = jest.fn();

    const result = await fetchInbox();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null when member_id cannot be resolved', async () => {
    mockGetMemberId.mockResolvedValue(null);

    global.fetch = jest.fn();

    const result = await fetchInbox();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes next_cursor for pagination chaining', async () => {
    const cursor = '2026-07-18T08:00:00Z';
    const apiResponse = {
      notifications: [NOTIFICATION_2],
      unread_count: 0,
      next_cursor: cursor,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(apiResponse),
    });

    const result = await fetchInbox();
    expect(result!.next_cursor).toBe(cursor);
  });
});

// ─── markRead ────────────────────────────────────────────────────────────────

describe('markRead', () => {
  const NOTIF_ID = 'notif-001';

  it('returns true on successful mark-read (200)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await markRead(NOTIF_ID);
    expect(result).toBe(true);
  });

  it('sends Bearer JWT in Authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await markRead(NOTIF_ID);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('sends member_id in POST body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await markRead(NOTIF_ID);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.member_id).toBe(MEMBER_ID);
  });

  it('POSTs to the correct URL with notif id', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await markRead(NOTIF_ID);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/api/member/notifications/${NOTIF_ID}/read`);
  });

  it('returns false on 4xx response (never throws)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });

    const result = await markRead(NOTIF_ID);
    expect(result).toBe(false);
  });

  it('returns false on network throw (never throws)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await markRead(NOTIF_ID);
    expect(result).toBe(false);
  });

  it('returns false when no session is available', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    global.fetch = jest.fn();

    const result = await markRead(NOTIF_ID);
    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
