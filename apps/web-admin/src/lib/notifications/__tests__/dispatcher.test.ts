/**
 * @jest-environment node
 *
 * Tests: Central notification dispatcher (06-03)
 * Covers: preference guards, quiet hours, dedup (5-min), rate cap (10/hr),
 *         identity bridge, loop safety, inbox writes, Edge Function delivery.
 *
 * Guard order asserted via call-count checks per the interfaces spec.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Mocks declared before imports ─────────────────────────────────────────────

jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => mockSupabaseAdmin),
  };
});

// ── Supabase chainable mock state ─────────────────────────────────────────────

// We build a "chainable" object where each from() call can be configured per-table
type QueryResult = { data: unknown; error: unknown; count?: number };

interface MockChain {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  limit: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
}

// We track calls to specific table/method combos
type TableHandler = () => Partial<MockChain> & { [key: string]: unknown };

const tableHandlers: Record<string, TableHandler> = {};

function buildChain(result: QueryResult): MockChain {
  const chain: MockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    limit: jest.fn().mockResolvedValue(result),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(result),
  };
  // Make most chained methods return a resolved promise by default too
  (chain.select as jest.Mock).mockImplementation(() => ({
    ...chain,
    eq: jest.fn().mockReturnThis(),
  }));
  return chain;
}

// The main mock admin — from() dispatches to tableHandlers
const mockSupabaseAdmin = {
  from: jest.fn((table: string) => {
    if (tableHandlers[table]) {
      return tableHandlers[table]();
    }
    // Default: empty success
    return buildChain({ data: null, error: null });
  }),
};

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ── Environment ───────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';

// ── Test constants ────────────────────────────────────────────────────────────

const MEMBER_ID = 'aaaa0001-0000-0000-0000-000000000001';
const PROFILE_ID = 'bbbb0001-0000-0000-0000-000000000001';
const GYM_ID = 'cccc0001-0000-0000-0000-000000000001';
const OTHER_MEMBER_ID = 'aaaa0002-0000-0000-0000-000000000002';

// ── Import subject (after mocks) ──────────────────────────────────────────────

import {
  sendNotification,
  resolveOwnerProfileId,
  isInQuietWindow,
  CATEGORY_COLUMN_MAP,
} from '../dispatcher';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a full prefs row (all enabled by default) */
function makePrefs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pref-01',
    member_id: MEMBER_ID,
    enabled: true,
    push_prs: true,
    push_achievements: true,
    push_level_up: true,
    push_challenge_rank: true,
    push_new_program: true,
    push_trainer_note: true,
    push_gym_feed: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00:00',
    quiet_hours_end: '07:00:00',
    ...overrides,
  };
}

/** Stub the standard "happy path" tables */
function setupHappyPath(overrides: {
  memberUserId?: string | null;
  prefs?: Record<string, unknown> | null;
  notifCount?: number;
  logCount?: number;
  hourlyLogCount?: number;
} = {}) {
  const {
    memberUserId = PROFILE_ID,
    prefs = makePrefs(),
    notifCount = 0,
    logCount = 0,
    hourlyLogCount = 0,
  } = overrides;

  // members table: returns user_id when queried by member_id
  // Also returns member_id when queried by profile_id (user_id)
  tableHandlers['members'] = () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { user_id: memberUserId, id: MEMBER_ID },
        error: null,
      }),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: MEMBER_ID, user_id: memberUserId },
        error: null,
      }),
    };
    // Make eq chaining work
    chain.eq.mockReturnValue(chain);
    return chain;
  };

  // notification_preferences
  tableHandlers['notification_preferences'] = () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: prefs, error: prefs ? null : { code: 'PGRST116' } }),
      maybeSingle: jest.fn().mockResolvedValue({ data: prefs, error: null }),
    };
    chain.eq.mockReturnValue(chain);
    return chain;
  };

  // notifications (inbox + dedup count)
  let notifInsertMock = jest.fn().mockResolvedValue({ data: { id: 'notif-01' }, error: null });
  let notifSelectCallCount = 0;
  tableHandlers['notifications'] = () => {
    notifSelectCallCount++;
    const chain = {
      select: jest.fn().mockReturnThis(),
      insert: notifInsertMock,
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ count: notifCount, data: [], error: null }),
    };
    chain.eq.mockReturnValue(chain);
    chain.gt.mockReturnValue(chain);
    // When select is called, return a chain that resolves to count
    chain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gt: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: Array(notifCount).fill({}), error: null, count: notifCount }),
          }),
        }),
      }),
    });
    return chain;
  };

  // notification_log
  let logSelectCallCount = 0;
  tableHandlers['notification_log'] = () => {
    logSelectCallCount++;
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: Array(logCount).fill({}), error: null, count: logCount }),
            }),
          }),
          gt: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: Array(hourlyLogCount).fill({}), error: null, count: hourlyLogCount }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  };

  // Edge Function fetch default: sent=1
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ sent: 1 }),
  });

  return { notifInsertMock };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('sendNotification dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseAdmin.from.mockClear();
    // Clear all table handlers
    Object.keys(tableHandlers).forEach(k => delete tableHandlers[k]);
    mockFetch.mockReset();
  });

  // ── 1. Category opt-out ───────────────────────────────────────────────────

  it('1. category opt-out: push_prs=false + type pr_achieved → skipped, fetch never called, inbox WAS inserted', async () => {
    const { notifInsertMock } = setupHappyPath({
      prefs: makePrefs({ push_prs: false }),
    });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'pr_achieved',
      title: 'New PR!',
      body: 'You hit a new personal record.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
    // Inbox row MUST have been inserted (even though push was skipped)
    expect(notifInsertMock).toHaveBeenCalledTimes(1);
  });

  // ── 2. Global opt-out ────────────────────────────────────────────────────

  it('2a. global opt-out: enabled=false → skipped for mapped type, fetch never called', async () => {
    setupHappyPath({ prefs: makePrefs({ enabled: false }) });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'pr_achieved',
      title: 'New PR!',
      body: 'You hit a new personal record.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('2b. global opt-out: enabled=false → skipped for unmapped type, fetch never called', async () => {
    setupHappyPath({ prefs: makePrefs({ enabled: false }) });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'agent_welcome',
      title: 'Welcome!',
      body: 'Welcome to Nexera.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 3. Quiet hours same-day window ───────────────────────────────────────

  it('3. quiet hours same-day window (start 13:00:00 end 15:00:00, now=14:00:00) → skipped', async () => {
    // We need to control "now" — dispatcher exports an injectable seam
    // or we spy on Date.prototype. For now, test isInQuietWindow directly
    // and test that the dispatcher uses it with the correct window.
    const result = isInQuietWindow('14:00:00', '13:00:00', '15:00:00');
    expect(result).toBe(true);
  });

  // ── 4. Quiet hours overnight window ──────────────────────────────────────

  it('4a. quiet hours overnight: 23:30:00 inside window (22:00→07:00) → skipped', () => {
    expect(isInQuietWindow('23:30:00', '22:00:00', '07:00:00')).toBe(true);
  });

  it('4b. quiet hours overnight: 06:30:00 inside window (22:00→07:00) → skipped', () => {
    expect(isInQuietWindow('06:30:00', '22:00:00', '07:00:00')).toBe(true);
  });

  it('4c. quiet hours overnight: 12:00:00 outside window (22:00→07:00) → proceeds', () => {
    expect(isInQuietWindow('12:00:00', '22:00:00', '07:00:00')).toBe(false);
  });

  // ── 5. isInQuietWindow boundaries ────────────────────────────────────────

  it('5a. isInQuietWindow: exact start time (same-day) → skipped', () => {
    expect(isInQuietWindow('13:00:00', '13:00:00', '15:00:00')).toBe(true);
  });

  it('5b. isInQuietWindow: exact end time (same-day) → skipped', () => {
    expect(isInQuietWindow('15:00:00', '13:00:00', '15:00:00')).toBe(true);
  });

  it('5c. isInQuietWindow: exact start time (overnight) → skipped', () => {
    expect(isInQuietWindow('22:00:00', '22:00:00', '07:00:00')).toBe(true);
  });

  it('5d. isInQuietWindow: exact end time (overnight) → skipped', () => {
    expect(isInQuietWindow('07:00:00', '22:00:00', '07:00:00')).toBe(true);
  });

  // ── 6. 5-min dedup member-facing ─────────────────────────────────────────

  it('6. 5-min dedup member-facing: notifications count > 0 → skipped, no second inbox insert', async () => {
    const { notifInsertMock } = setupHappyPath({ notifCount: 1 });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'pr_achieved',
      title: 'New PR!',
      body: 'You hit a new personal record.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('skipped');
    // No inbox insert when dedup fires (dedup is step 2, inbox is step 3)
    expect(notifInsertMock).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 7. 5-min dedup owner-only ─────────────────────────────────────────────

  it('7. 5-min dedup owner-only: notification_log count > 0 → skipped', async () => {
    setupHappyPath({ logCount: 1 });

    // Override members to return null — pure owner-only, no member row for this profile
    tableHandlers['members'] = () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      chain.eq.mockReturnValue(chain);
      return chain;
    };

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'trial_ending',
      title: 'Trial ending soon',
      body: 'Your trial ends in 3 days.',
      profile_id: PROFILE_ID,
      // No member_id → owner-only path
    });

    expect(result).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 8. Hourly rate cap ───────────────────────────────────────────────────

  it('8. hourly rate cap: notification_log sent-count = 10 → skipped', async () => {
    setupHappyPath({ hourlyLogCount: 10 });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 9. Identity bridge member→profile ────────────────────────────────────

  it('9. identity bridge member→profile: member_id only → members.user_id used as Edge Function profile_id', async () => {
    setupHappyPath({ memberUserId: PROFILE_ID });

    await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    // Edge Function must have been called with the resolved profile_id
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('send-push-notification');
    const body = JSON.parse(options.body as string);
    expect(body.profile_id).toBe(PROFILE_ID);
  });

  // ── 10. Identity bridge profile→member ───────────────────────────────────

  it('10. identity bridge profile→member: profile_id only → members lookup by user_id+gym_id → inbox written to that member_id', async () => {
    const { notifInsertMock } = setupHappyPath();

    // profile_id only (no member_id) — type is member-facing (coach_note)
    // But with profile_id and a resolved member, inbox should be written
    await sendNotification({
      gym_id: GYM_ID,
      type: 'coach_note',
      title: 'New coach note',
      body: 'Your trainer left a note.',
      profile_id: PROFILE_ID,
    });

    // Inbox row written with the resolved member_id
    expect(notifInsertMock).toHaveBeenCalledTimes(1);
    const insertArg = notifInsertMock.mock.calls[0][0];
    expect(insertArg.member_id).toBe(MEMBER_ID);
  });

  // ── 11. Unclaimed member (user_id null) ──────────────────────────────────

  it('11. unclaimed member (user_id null): inbox row written, returns no_devices, fetch never called', async () => {
    const { notifInsertMock } = setupHappyPath({ memberUserId: null });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'pr_achieved',
      title: 'New PR!',
      body: 'You hit a new personal record.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('no_devices');
    expect(mockFetch).not.toHaveBeenCalled();
    // Inbox row WAS inserted
    expect(notifInsertMock).toHaveBeenCalledTimes(1);
  });

  // ── 12. Owner-only send (profile_id, no member row) ──────────────────────

  it('12. owner-only send: profile_id, no matching member → no inbox insert, Edge Function called', async () => {
    const { notifInsertMock } = setupHappyPath();

    // Override members to return null (no member row for this profile_id)
    tableHandlers['members'] = () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      chain.eq.mockReturnValue(chain);
      return chain;
    };

    // Override notification_log dedup to return 0 (no recent log)
    tableHandlers['notification_log'] = () => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          gt: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'trial_ending',
      title: 'Trial ending soon',
      body: 'Your trial ends in 3 days.',
      profile_id: PROFILE_ID,
    });

    // No member_id resolved → no inbox insert
    expect(notifInsertMock).not.toHaveBeenCalled();
    // Edge Function should be called since profile_id is known
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── 13. Missing prefs row → defaults open → sent ─────────────────────────

  it('13. missing prefs row → defaults open → sent', async () => {
    setupHappyPath({ prefs: null });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('sent');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── 14. is_agent_initiated propagation + loop safety ────────────────────

  it('14a. is_agent_initiated=true → Edge Function body data.is_agent_initiated === "true"', async () => {
    setupHappyPath();

    await sendNotification({
      gym_id: GYM_ID,
      type: 'agent_dormant_alert',
      title: 'Time to return',
      body: "It's been a while since your last workout.",
      member_id: MEMBER_ID,
      is_agent_initiated: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.data?.is_agent_initiated).toBe('true');
  });

  it('14b. loop safety: dispatcher.ts contains no triggerUptimizeAIAgent or billing/triggerAgent import', () => {
    const dispatcherPath = path.resolve(
      __dirname,
      '../dispatcher.ts'
    );
    const source = fs.readFileSync(dispatcherPath, 'utf-8');
    expect(source).not.toMatch(/triggerUptimizeAIAgent|billing\/triggerAgent/);
  });

  // ── 15. Edge Function response handling ──────────────────────────────────

  it('15a. Edge Function { sent: 1 } → sent', async () => {
    setupHappyPath();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: 1 }),
    });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('sent');
  });

  it('15b. Edge Function { sent: 0 } → no_devices', async () => {
    setupHappyPath();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: 0 }),
    });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('no_devices');
  });

  it('15c. Edge Function message-only → no_devices', async () => {
    setupHappyPath();
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Push notifications are disabled' }),
    });

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('no_devices');
  });

  it('15d. fetch throws → returns error, never throws to caller', async () => {
    setupHappyPath();
    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const result = await sendNotification({
      gym_id: GYM_ID,
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached a new level.',
      member_id: MEMBER_ID,
    });

    expect(result).toBe('error');
    // No throw — caller receives 'error' not an exception
  });

  // ── 16. resolveOwnerProfileId ────────────────────────────────────────────

  it('16a. resolveOwnerProfileId: active owner row → returns user_id', async () => {
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { user_id: PROFILE_ID },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await resolveOwnerProfileId(
      mockAdmin as unknown as import('@supabase/supabase-js').SupabaseClient,
      GYM_ID
    );
    expect(result).toBe(PROFILE_ID);
  });

  it('16b. resolveOwnerProfileId: no active owner row → returns null', async () => {
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await resolveOwnerProfileId(
      mockAdmin as unknown as import('@supabase/supabase-js').SupabaseClient,
      GYM_ID
    );
    expect(result).toBeNull();
  });
});

// ── CATEGORY_COLUMN_MAP completeness checks ────────────────────────────────

describe('CATEGORY_COLUMN_MAP', () => {
  it('maps pr_achieved to push_prs', () => {
    expect(CATEGORY_COLUMN_MAP['pr_achieved']).toBe('push_prs');
  });

  it('maps badge_unlocked, streak_milestone, streak_broken to push_achievements', () => {
    expect(CATEGORY_COLUMN_MAP['badge_unlocked']).toBe('push_achievements');
    expect(CATEGORY_COLUMN_MAP['streak_milestone']).toBe('push_achievements');
    expect(CATEGORY_COLUMN_MAP['streak_broken']).toBe('push_achievements');
  });

  it('maps level_up to push_level_up', () => {
    expect(CATEGORY_COLUMN_MAP['level_up']).toBe('push_level_up');
  });

  it('maps challenge_rank_change, challenge_complete, leaderboard_rank to push_challenge_rank', () => {
    expect(CATEGORY_COLUMN_MAP['challenge_rank_change']).toBe('push_challenge_rank');
    expect(CATEGORY_COLUMN_MAP['challenge_complete']).toBe('push_challenge_rank');
    expect(CATEGORY_COLUMN_MAP['leaderboard_rank']).toBe('push_challenge_rank');
  });

  it('unmapped types (agent_dormant_alert, trial_ending) are undefined in map', () => {
    expect(CATEGORY_COLUMN_MAP['agent_dormant_alert']).toBeUndefined();
    expect(CATEGORY_COLUMN_MAP['trial_ending']).toBeUndefined();
  });
});
