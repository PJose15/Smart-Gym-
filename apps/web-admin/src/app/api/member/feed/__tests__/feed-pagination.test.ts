/**
 * @jest-environment node
 *
 * Tests for GET /api/member/feed — cursor pagination.
 *
 * Regression under test (Stage 6, audit "Integration" medium): the
 * next_cursor used to be computed from the combined pinned+chronological
 * list, so whenever pinned events existed page 1 had more than `limit`
 * events, `events.length === limit` was false, next_cursor came back null
 * and pagination halted after one page. The cursor must derive from the
 * chronological rows only.
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockVerifyMember = jest.fn();
jest.mock('@/lib/auth/verifyMember', () => ({
  verifyMember: (...args: unknown[]) => mockVerifyMember(...args),
}));

const mockResolveMemberGym = jest.fn();
jest.mock('@/lib/auth/tenant', () => ({
  resolveMemberGym: (...args: unknown[]) => mockResolveMemberGym(...args),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));

// ─── Chainable query mock ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
interface QueryResult { data?: unknown; error?: unknown }

function makeChain(result: QueryResult) {
  const chain: any = { _calls: [] as Array<[string, unknown[]]> };
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lt', 'order', 'limit']) {
    chain[m] = jest.fn((...args: unknown[]) => {
      chain._calls.push([m, args]);
      return chain;
    });
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const MEMBER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const GYM_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

function eventRow(id: string, createdAt: string, isPinned = false) {
  return {
    id,
    gym_id: GYM_ID,
    member_id: MEMBER_ID,
    event_type: 'streak_milestone',
    display_text: 'is on a 7-day streak!',
    context_data: {},
    priority: 'medium',
    is_pinned: isPinned,
    comment_count: 0,
    created_at: createdAt,
  };
}

/** Queue-based admin: each from(table) pops the next prepared chain. */
function makeAdmin(queues: Record<string, any[]>) {
  return {
    from: jest.fn((table: string) => {
      const q = queues[table];
      if (!q || q.length === 0) throw new Error(`Unexpected from('${table}')`);
      return q.shift();
    }),
  };
}

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/member/feed');
  url.searchParams.set('member_id', MEMBER_ID);
  url.searchParams.set('gym_id', GYM_ID);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

let GET: (req: NextRequest) => Promise<NextResponse>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveMemberGym.mockResolvedValue(GYM_ID);
});

describe('GET /api/member/feed pagination', () => {
  test('T01: full chrono page WITH pinned events still returns next_cursor (regression)', async () => {
    const pinned = [eventRow('pin-1', '2026-09-01T00:00:00Z', true)];
    const chrono = [
      eventRow('c-1', '2026-09-04T12:00:00Z'),
      eventRow('c-2', '2026-09-04T11:00:00Z'),
      eventRow('c-3', '2026-09-04T10:00:00Z'),
    ];
    const admin = makeAdmin({
      gym_feed_events: [makeChain({ data: pinned }), makeChain({ data: chrono, error: null })],
      members: [makeChain({ data: [] })],
      feed_reactions: [makeChain({ data: [] }), makeChain({ data: [] })],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await GET(makeRequest({ limit: '3' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 1 pinned + 3 chrono events returned, pinned first
    expect(body.events).toHaveLength(4);
    expect(body.events[0].id).toBe('pin-1');
    // Cursor comes from the LAST CHRONOLOGICAL row, not null
    expect(body.next_cursor).toBe('2026-09-04T10:00:00Z');
  });

  test('T02: partial chrono page → next_cursor null (end of feed)', async () => {
    const pinned = [eventRow('pin-1', '2026-09-01T00:00:00Z', true)];
    const chrono = [eventRow('c-1', '2026-09-04T12:00:00Z')];
    const admin = makeAdmin({
      gym_feed_events: [makeChain({ data: pinned }), makeChain({ data: chrono, error: null })],
      members: [makeChain({ data: [] })],
      feed_reactions: [makeChain({ data: [] }), makeChain({ data: [] })],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await GET(makeRequest({ limit: '3' }));
    const body = await res.json();
    expect(body.events).toHaveLength(2);
    expect(body.next_cursor).toBeNull();
  });

  test('T03: cursor request skips pinned query and pages from chrono rows', async () => {
    const chrono = [
      eventRow('c-4', '2026-09-04T09:00:00Z'),
      eventRow('c-5', '2026-09-04T08:00:00Z'),
    ];
    const chronoChain = makeChain({ data: chrono, error: null });
    const admin = makeAdmin({
      gym_feed_events: [chronoChain],
      members: [makeChain({ data: [] })],
      feed_reactions: [makeChain({ data: [] }), makeChain({ data: [] })],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await GET(makeRequest({ limit: '2', cursor: '2026-09-04T10:00:00Z' }));
    const body = await res.json();

    // Only ONE gym_feed_events query (no pinned fetch on cursor pages)
    expect(admin.from.mock.calls.filter(([t]: [string]) => t === 'gym_feed_events')).toHaveLength(1);
    expect(chronoChain.lt).toHaveBeenCalledWith('created_at', '2026-09-04T10:00:00Z');
    expect(body.events).toHaveLength(2);
    expect(body.next_cursor).toBe('2026-09-04T08:00:00Z');
  });

  test('T04: empty feed → empty events, null cursor', async () => {
    const admin = makeAdmin({
      gym_feed_events: [makeChain({ data: [] }), makeChain({ data: [], error: null })],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await GET(makeRequest({}));
    const body = await res.json();
    expect(body.events).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  test('T05: verifyMember failure passes through', async () => {
    mockVerifyMember.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(401);
  });

  test('T06: unresolvable gym → 403', async () => {
    mockVerifyMember.mockResolvedValue({ admin: makeAdmin({}), member_id: MEMBER_ID });
    mockResolveMemberGym.mockResolvedValue(null);
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(403);
  });
});
