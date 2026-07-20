/**
 * @jest-environment node
 *
 * Tests for:
 *   GET  /api/member/notifications
 *   POST /api/member/notifications/[notifId]/read
 *
 * Covers NOTIF-05: paginated inbox list + unread count + idempotent mark-read.
 *
 * Mocks:
 *   - @supabase/supabase-js (createClient) — admin client
 *   - @/lib/supabase/server (createServerSupabaseClient) — cookie path
 *   - @/lib/auth/verifyMember — returns success or NextResponse 401/403
 *   - @/lib/rateLimit — checkRateLimit returns null (allowed) by default
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Mock verifyMember ────────────────────────────────────────────────────────
const mockVerifyMember = jest.fn();
jest.mock('@/lib/auth/verifyMember', () => ({
  verifyMember: (...args: unknown[]) => mockVerifyMember(...args),
}));

// ─── Mock rateLimit ───────────────────────────────────────────────────────────
const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ─── Supabase query chain mocks ───────────────────────────────────────────────
// Query chains used in the routes (all routed via makeAdminMock per-test admin):
//
// GET list:  .from('notifications').select(...).eq(member_id).order(...)[.lt(cursor)].limit(n)
// GET count: .from('notifications').select('*',{count:'exact',head:true}).eq(member_id).is('read_at',null)
// POST upd:  .from('notifications').update({read_at}).eq(id).eq(member_id).select('id').single()
// POST exist:.from('notifications').select('id').eq(id).eq(member_id).maybeSingle()

// List query chain
const mockListLimit = jest.fn();
const mockListLt = jest.fn(() => ({ limit: mockListLimit }));
const mockListOrder = jest.fn(() => ({ limit: mockListLimit, lt: mockListLt }));
const mockListEq = jest.fn(() => ({ order: mockListOrder }));

// Unread count query chain
const mockUnreadIs = jest.fn();
const mockUnreadEq = jest.fn(() => ({ is: mockUnreadIs }));

// POST update query chain
const mockUpdateSingle = jest.fn();
const mockUpdateSelect = jest.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEqMember = jest.fn(() => ({ select: mockUpdateSelect }));
const mockUpdateEqId = jest.fn(() => ({ eq: mockUpdateEqMember }));
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEqId }));

// POST existence check chain
const mockExistMaybeSingle = jest.fn();
const mockExistEqMember = jest.fn(() => ({ maybeSingle: mockExistMaybeSingle }));
const mockExistEqId = jest.fn(() => ({ eq: mockExistEqMember }));

// Top-level module mock (required by Jest to intercept createClient at import time).
// The actual per-test admin client is returned by mockVerifyMember — see makeAdminMock().
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMBER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTIF_ID  = 'bbbbbbbb-0000-0000-0000-000000000002';
const OTHER_NOTIF = 'cccccccc-0000-0000-0000-000000000003';

const SAMPLE_NOTIFICATIONS = [
  {
    id: NOTIF_ID,
    notification_type: 'level_up',
    title: 'Level Up!',
    body: 'You reached level 5',
    data: {},
    read_at: null,
    created_at: '2026-07-20T10:00:00Z',
  },
  {
    id: OTHER_NOTIF,
    notification_type: 'streak',
    title: '5-day streak',
    body: 'Keep it up!',
    data: { streak: '5' },
    read_at: '2026-07-19T09:00:00Z',
    created_at: '2026-07-19T09:00:00Z',
  },
];

function makeAdminMock() {
  let fromCallCount = 0;
  return {
    member_id: MEMBER_ID,
    admin: {
      from: jest.fn((table: string) => {
        if (table === 'notifications') {
          fromCallCount++;
          const thisFromCall = fromCallCount;
          return {
            select: jest.fn((cols: unknown, opts?: unknown) => {
              // Head count query (unread count) — distinguished by opts.head
              if (opts && (opts as { head?: boolean }).head === true) {
                return { eq: mockUnreadEq };
              }
              // POST route: from call 1 = update path (update is called, not select)
              // POST route: from call 2 = existence check (.select('id').eq().eq().maybeSingle())
              // GET route: from call 1 = list query; from call 2 = unread count (already caught above)
              if (thisFromCall >= 2) {
                // Existence check path
                return { eq: mockExistEqId };
              }
              return { eq: mockListEq };
            }),
            update: mockUpdate,
          };
        }
        return {};
      }),
    },
  };
}

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/member/notifications');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

function makePostRequest(body: unknown, notifId = NOTIF_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/member/notifications/${notifId}/read`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────
let GET: (req: NextRequest) => Promise<NextResponse>;
let POST: (req: NextRequest, ctx: { params: Promise<{ notifId: string }> }) => Promise<NextResponse>;

beforeAll(async () => {
  const listMod = await import('../route');
  GET = listMod.GET;
  // Jest glob-expands [...] in dynamic import — use require() to bypass
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const readMod = require('../[notifId]/read/route') as { POST: typeof POST };
  POST = readMod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: verifyMember succeeds
  mockVerifyMember.mockResolvedValue(makeAdminMock());
  // Default: rate limit allows
  mockCheckRateLimit.mockReturnValue(null);
  // Default: list query returns 2 rows
  mockListEq.mockReturnValue({
    order: mockListOrder,
  });
  mockListOrder.mockReturnValue({ limit: mockListLimit, lt: mockListLt });
  mockListLt.mockReturnValue({ limit: mockListLimit });
  mockListLimit.mockResolvedValue({ data: SAMPLE_NOTIFICATIONS, error: null });
  // Default: unread count = 1
  mockUnreadIs.mockResolvedValue({ count: 1, error: null });
  // Default: update finds and marks row
  mockUpdateEqId.mockReturnValue({ eq: mockUpdateEqMember });
  mockUpdateEqMember.mockReturnValue({ select: mockUpdateSelect });
  mockUpdateSelect.mockReturnValue({ single: mockUpdateSingle });
  mockUpdateSingle.mockResolvedValue({ data: { id: NOTIF_ID }, error: null });
  // Default: existence check (used when update returns null — idempotency/404 path)
  mockExistEqId.mockReturnValue({ eq: mockExistEqMember });
  mockExistEqMember.mockReturnValue({ maybeSingle: mockExistMaybeSingle });
  mockExistMaybeSingle.mockResolvedValue({ data: null, error: null });
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/member/notifications', () => {
  test('T01: missing member_id → 400', async () => {
    const req = makeGetRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('T02: invalid member_id UUID → 400', async () => {
    const req = makeGetRequest({ member_id: 'not-a-uuid' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('T03: verifyMember 401 → passthrough 401', async () => {
    mockVerifyMember.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const req = makeGetRequest({ member_id: MEMBER_ID });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('T04: returns notifications list with unread_count and next_cursor=null when page not full', async () => {
    const req = makeGetRequest({ member_id: MEMBER_ID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('notifications');
    expect(body).toHaveProperty('unread_count', 1);
    expect(body).toHaveProperty('next_cursor', null);
    expect(body.notifications).toHaveLength(2);
    // Verify only contract columns are present
    const n = body.notifications[0];
    expect(n).toHaveProperty('id');
    expect(n).toHaveProperty('notification_type');
    expect(n).toHaveProperty('title');
    expect(n).toHaveProperty('body');
    expect(n).toHaveProperty('data');
    expect(n).toHaveProperty('read_at');
    expect(n).toHaveProperty('created_at');
  });

  test('T05: full page returns next_cursor = created_at of last row', async () => {
    // Return 20 rows (default limit) — means page is full
    const fullPage = Array.from({ length: 20 }, (_, i) => ({
      id: `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`,
      notification_type: 'streak',
      title: 'Test',
      body: 'Test body',
      data: {},
      read_at: null,
      created_at: `2026-07-${String(20 - i).padStart(2, '0')}T00:00:00Z`,
    }));
    mockListLimit.mockResolvedValue({ data: fullPage, error: null });

    const req = makeGetRequest({ member_id: MEMBER_ID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next_cursor).toBe(fullPage[fullPage.length - 1].created_at);
    expect(body.notifications).toHaveLength(20);
  });

  test('T06: cursor param filters rows lt created_at', async () => {
    const cursor = '2026-07-19T00:00:00Z';
    mockListLimit.mockResolvedValue({ data: [SAMPLE_NOTIFICATIONS[1]], error: null });
    const req = makeGetRequest({ member_id: MEMBER_ID, cursor });
    const res = await GET(req);
    expect(res.status).toBe(200);
    // mockListLt should have been called with ('created_at', cursor)
    expect(mockListLt).toHaveBeenCalledWith('created_at', cursor);
  });

  test('T07: limit capped at 50', async () => {
    mockListLimit.mockResolvedValue({ data: [], error: null });
    const req = makeGetRequest({ member_id: MEMBER_ID, limit: '200' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    // The actual limit call should pass ≤ 50
    expect(mockListLimit).toHaveBeenCalledWith(50);
  });

  test('T08: DB error on list → 500', async () => {
    mockListLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const req = makeGetRequest({ member_id: MEMBER_ID });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ─── POST tests ───────────────────────────────────────────────────────────────

describe('POST /api/member/notifications/[notifId]/read', () => {
  async function makeCtx(notifId = NOTIF_ID) {
    return { params: Promise.resolve({ notifId }) };
  }

  test('T09: invalid notifId UUID → 400', async () => {
    const req = makePostRequest({ member_id: MEMBER_ID }, 'not-a-uuid');
    const res = await POST(req, await makeCtx('not-a-uuid'));
    expect(res.status).toBe(400);
  });

  test('T10: invalid member_id UUID in body → 400', async () => {
    const req = makePostRequest({ member_id: 'not-a-uuid' });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(400);
  });

  test('T11: missing member_id → 400', async () => {
    const req = makePostRequest({});
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(400);
  });

  test('T12: verifyMember 401 → passthrough 401', async () => {
    mockVerifyMember.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const req = makePostRequest({ member_id: MEMBER_ID });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(401);
  });

  test('T13: rate limited → 429', async () => {
    mockCheckRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );
    const req = makePostRequest({ member_id: MEMBER_ID });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(429);
  });

  test('T14: successful mark-read → { success: true }', async () => {
    const req = makePostRequest({ member_id: MEMBER_ID });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('T15: already read (idempotent) → { success: true }', async () => {
    // update returns null data (row was already read, WHERE read_at IS NULL matched 0 rows)
    mockUpdateSingle.mockResolvedValue({ data: null, error: null });
    // existence check: row exists for this member (just already read)
    mockExistMaybeSingle.mockResolvedValue({ data: { id: NOTIF_ID }, error: null });
    const req = makePostRequest({ member_id: MEMBER_ID });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('T16: notifId belongs to another member → 404', async () => {
    // update returns null data (not owned)
    mockUpdateSingle.mockResolvedValue({ data: null, error: null });
    // existence check: row not found for this member
    mockExistMaybeSingle.mockResolvedValue({ data: null, error: null });
    const req = makePostRequest({ member_id: MEMBER_ID });
    const res = await POST(req, await makeCtx());
    expect(res.status).toBe(404);
  });
});
