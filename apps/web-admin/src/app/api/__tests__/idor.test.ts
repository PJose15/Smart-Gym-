/**
 * @jest-environment node
 *
 * Stage 5 — IDOR / tenant-binding contract lock.
 *
 * For each tenant-bound route: at least one ALLOW (own-tenant works) and one
 * DENY (cross-tenant → 403/404, no side effects) test. These lock the
 * security contract — gym_id is ALWAYS derived from the verified member/staff
 * row and never from a caller-supplied body/query value.
 */

// ── Mocks declared before imports ─────────────────────────────────────────────
jest.mock('@/lib/auth/verifyMember');
jest.mock('@/lib/auth/verifyStaff');
jest.mock('@/lib/auth/tenant');
jest.mock('@/lib/rateLimit');
jest.mock('@/lib/billing/featureGate');
jest.mock('@/lib/notifications/dispatcher');
jest.mock('@/lib/social/machineLeaderboard');
jest.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

// ── Imports ───────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { POST as sessionsPOST } from '../sessions/route';
import { POST as prCheckPOST } from '../sessions/pr-check/route';
import { GET as feedGET } from '../member/feed/route';
import { POST as reactPOST } from '../member/feed/react/route';
import { POST as joinPOST } from '../member/challenges/[challengeId]/join/route';
import { GET as leaderboardGET } from '../machine/[machineId]/leaderboard/route';
import { GET as tipsGET } from '../tips/route';
import { PATCH as programPATCH } from '../ai/programs/[programId]/route';

import { verifyMember } from '@/lib/auth/verifyMember';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { resolveMemberGym, assertInGym } from '@/lib/auth/tenant';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkFeatureAccess } from '@/lib/billing/featureGate';
import { sendNotification } from '@/lib/notifications/dispatcher';
import { getMachineLeaderboard } from '@/lib/social/machineLeaderboard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// ── Typed mock refs ───────────────────────────────────────────────────────────
const mockVerifyMember = verifyMember as jest.MockedFunction<typeof verifyMember>;
const mockVerifyStaff = verifyStaff as jest.MockedFunction<typeof verifyStaff>;
const mockResolveMemberGym = resolveMemberGym as jest.MockedFunction<typeof resolveMemberGym>;
const mockAssertInGym = assertInGym as jest.MockedFunction<typeof assertInGym>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockFeatureAccess = checkFeatureAccess as jest.MockedFunction<typeof checkFeatureAccess>;
const mockSendNotification = sendNotification as jest.MockedFunction<typeof sendNotification>;
const mockLeaderboard = getMachineLeaderboard as jest.MockedFunction<typeof getMachineLeaderboard>;
const mockServerClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// ── Test constants (hex-shaped UUIDs, pass uuidString/validateUUIDs) ─────────
const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const REAL_GYM = '22222222-2222-4222-8222-222222222222';
const EVIL_GYM = '33333333-3333-4333-8333-333333333333';
const MACHINE_ID = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '55555555-5555-4555-8555-555555555555';
const EVENT_ID = '66666666-6666-4666-8666-666666666666';
const CHALLENGE_ID = '77777777-7777-4777-8777-777777777777';
const PROGRAM_ID = '88888888-8888-4888-8888-888888888888';
const USER_ID = '99999999-9999-4999-8999-999999999999';

// ── Chainable admin mock ─────────────────────────────────────────────────────
// Every builder method returns the chain; awaiting the chain at any point
// resolves the next queued result for that table. All (table, method, args)
// calls are recorded in `ops` so tests can assert gym scoping / absent writes.

interface TableResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}
interface Op {
  table: string;
  method: string;
  args: unknown[];
  /** Index of the from() call that opened this chain — lets tests bind
   *  assertions to a SPECIFIC query instead of any query on the table. */
  chain: number;
}

function makeAdmin(
  queuesInit: Record<string, TableResult[]> = {},
  rpcResult: TableResult = { data: null, error: null }
) {
  const queues: Record<string, TableResult[]> = {};
  for (const [table, results] of Object.entries(queuesInit)) {
    queues[table] = [...results];
  }
  const ops: Op[] = [];
  let chainCounter = 0;

  const CHAIN_METHODS = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'lt', 'gt', 'gte', 'not',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ];

  const from = jest.fn((table: string) => {
    const chainIndex = chainCounter++;
    const queue = queues[table];
    const result = queue && queue.length > 0 ? queue.shift()! : { data: null, error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};
    for (const method of CHAIN_METHODS) {
      chain[method] = jest.fn((...args: unknown[]) => {
        ops.push({ table, method, args, chain: chainIndex });
        return chain;
      });
    }
    chain.then = (
      onFulfilled: (v: TableResult) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null, count: null, ...result }).then(onFulfilled, onRejected);
    return chain;
  });

  const rpc = jest.fn().mockResolvedValue({ data: null, error: null, ...rpcResult });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { from, rpc } as any;
  return { admin, from, rpc, ops };
}

const opsHas = (ops: Op[], table: string, method: string, ...args: unknown[]) =>
  ops.some(
    (o) =>
      o.table === table &&
      o.method === method &&
      args.every((a, i) => o.args[i] === a)
  );

/** Ops belonging to the nth from(table) chain (0-based, in call order). */
const nthChainOps = (ops: Op[], table: string, nth: number) => {
  const chainIds = [...new Set(ops.filter((o) => o.table === table).map((o) => o.chain))];
  return ops.filter((o) => o.chain === chainIds[nth]);
};

const chainHas = (chainOps: Op[], method: string, ...args: unknown[]) =>
  chainOps.some((o) => o.method === method && args.every((a, i) => o.args[i] === a));

/** No recorded arg anywhere mentions the attacker-supplied gym. */
const noArgMentions = (ops: Op[], value: unknown) =>
  !ops.some((o) => o.args.some((a) => a === value || (a && typeof a === 'object' && Object.values(a).includes(value))));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAuth = (admin: any) =>
  ({ admin, member_id: MEMBER_ID } as unknown as Awaited<ReturnType<typeof verifyMember>>);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asStaff = (admin: any) =>
  ({ admin, user_id: USER_ID, gym_id: REAL_GYM, role: 'owner', permissions: {} } as unknown as Awaited<
    ReturnType<typeof verifyStaff>
  >);

const forbidden = () =>
  NextResponse.json({ error: 'Forbidden' }, { status: 403 }) as unknown as Awaited<
    ReturnType<typeof verifyMember>
  >;

function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockReturnValue(null);
  mockResolveMemberGym.mockResolvedValue(REAL_GYM);
  mockAssertInGym.mockResolvedValue(true);
  mockFeatureAccess.mockResolvedValue({ hasAccess: true } as unknown as Awaited<ReturnType<typeof checkFeatureAccess>>);
  mockSendNotification.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof sendNotification>>);
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. POST /api/sessions
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/sessions — tenant binding', () => {
  const body = {
    gym_id: EVIL_GYM, // attacker-supplied; must be IGNORED
    machine_id: MACHINE_ID,
    member_id: MEMBER_ID,
    session_date: '2026-09-05',
    workout_mode: 'free',
    set: { weight_lbs: 100, reps: 5 },
  };
  const makeReq = () => jsonRequest('http://localhost/api/sessions', body);

  it('DENY: machine not in member gym → 404, RPC never runs', async () => {
    const { admin, rpc } = makeAdmin({ machines: [{ data: null }] });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await sessionsPOST(makeReq());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Machine not found');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ALLOW: valid machine → 200; RPC receives the member REAL gym, not body gym_id', async () => {
    const sessionRow = {
      id: SESSION_ID,
      sets: [{ weight_lbs: 100, reps: 5 }],
      sets_count: 1,
      total_volume_lbs: 500,
      best_weight_lbs: 100,
      best_reps: 5,
    };
    const { admin, rpc, ops } = makeAdmin(
      { machines: [{ data: { id: MACHINE_ID } }] },
      { data: sessionRow }
    );
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await sessionsPOST(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_id).toBe(SESSION_ID);
    expect(json.sets_count).toBe(1);

    // Machine lookup scoped to the member's real gym
    expect(opsHas(ops, 'machines', 'eq', 'gym_id', REAL_GYM)).toBe(true);

    // RPC bound to the member's real gym — the body's EVIL_GYM never appears
    expect(rpc).toHaveBeenCalledWith(
      'append_session_set',
      expect.objectContaining({
        p_member_id: MEMBER_ID,
        p_gym_id: REAL_GYM,
        p_machine_id: MACHINE_ID,
      })
    );
    expect(rpc.mock.calls[0][1].p_gym_id).not.toBe(EVIL_GYM);
    expect(noArgMentions(ops, EVIL_GYM)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. POST /api/sessions/pr-check
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/sessions/pr-check — session ownership', () => {
  const body = {
    session_id: SESSION_ID,
    member_id: MEMBER_ID,
    machine_id: MACHINE_ID,
    weight_lbs: 100,
    reps: 5,
  };
  const makeReq = () => jsonRequest('http://localhost/api/sessions/pr-check', body);

  it('DENY: session not owned by member/machine → 404, markPR never runs', async () => {
    const { admin, ops } = makeAdmin({ workout_sessions: [{ data: null }] });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await prCheckPOST(makeReq());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Session not found');

    // No PR write, no feed event
    expect(ops.some((o) => o.method === 'update')).toBe(false);
    expect(ops.some((o) => o.table === 'gym_feed_events')).toBe(false);

    // The ownership check itself (first workout_sessions chain) carried all
    // three filters — the miss was a real scoped miss, not an unfiltered read.
    const ownership = nthChainOps(ops, 'workout_sessions', 0);
    expect(chainHas(ownership, 'eq', 'id', SESSION_ID)).toBe(true);
    expect(chainHas(ownership, 'eq', 'member_id', MEMBER_ID)).toBe(true);
    expect(chainHas(ownership, 'eq', 'machine_id', MACHINE_ID)).toBe(true);
  });

  it('ALLOW: owned session with no history → 200 first_session PR', async () => {
    const { admin, ops } = makeAdmin({
      workout_sessions: [
        // ownership check — route selects 'id, best_weight_lbs, total_volume_lbs'
        { data: { id: SESSION_ID, best_weight_lbs: 100, total_volume_lbs: 500 } },
        { data: [] }, // history → first session
        { error: null }, // markPR update
        { data: { gym_id: REAL_GYM } }, // insertFeedEvent gym lookup
      ],
      gym_feed_events: [{ error: null }],
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await prCheckPOST(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pr.type).toBe('first_session');
    // effectiveWeight = min(body weight, session best_weight_lbs)
    expect(json.pr.value).toBe(100);

    // Ownership check: the FIRST workout_sessions chain must itself carry
    // eq(id) + eq(member_id) + eq(machine_id). (A table-wide opsHas would be
    // vacuously satisfied by the history query's member/machine filters.)
    const ownership = nthChainOps(ops, 'workout_sessions', 0);
    expect(chainHas(ownership, 'select', 'id, best_weight_lbs, total_volume_lbs')).toBe(true);
    expect(chainHas(ownership, 'eq', 'id', SESSION_ID)).toBe(true);
    expect(chainHas(ownership, 'eq', 'member_id', MEMBER_ID)).toBe(true);
    expect(chainHas(ownership, 'eq', 'machine_id', MACHINE_ID)).toBe(true);

    // Feed event bound to the session's gym
    const insert = ops.find((o) => o.table === 'gym_feed_events' && o.method === 'insert');
    expect((insert?.args[0] as Record<string, unknown>).gym_id).toBe(REAL_GYM);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET /api/member/feed
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/member/feed — gym scoping', () => {
  const makeReq = (gymParam: string) =>
    new NextRequest(
      `http://localhost/api/member/feed?member_id=${MEMBER_ID}&gym_id=${gymParam}`
    );

  it('ALLOW: queries scoped to the member REAL gym; caller gym_id param ignored', async () => {
    const eventRow = {
      id: EVENT_ID,
      gym_id: REAL_GYM,
      member_id: MEMBER_ID,
      event_type: 'pr_weight',
      display_text: 'hit a new weight PR!',
      context_data: {},
      priority: 'medium',
      is_pinned: false,
      comment_count: 0,
      created_at: '2026-09-01T00:00:00.000Z',
    };
    const { admin, ops } = makeAdmin({
      gym_feed_events: [
        { data: [] }, // pinned
        { data: [eventRow] }, // chronological
      ],
      members: [{ data: [{ id: MEMBER_ID, display_name: 'Alice', avatar_url: null }] }],
      feed_reactions: [{ data: [] }, { data: [] }],
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await feedGET(makeReq(EVIL_GYM)); // attacker passes another gym
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0].id).toBe(EVENT_ID);

    // Gym derived from the member row, not the query param
    expect(mockResolveMemberGym).toHaveBeenCalledWith(admin, MEMBER_ID);
    expect(opsHas(ops, 'gym_feed_events', 'eq', 'gym_id', REAL_GYM)).toBe(true);
    expect(noArgMentions(ops, EVIL_GYM)).toBe(true);
  });

  it('DENY: member without a gym row → 403', async () => {
    const { admin } = makeAdmin();
    mockVerifyMember.mockResolvedValue(asAuth(admin));
    mockResolveMemberGym.mockResolvedValue(null);

    const res = await feedGET(makeReq(REAL_GYM));
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. POST /api/member/feed/react
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/member/feed/react — cross-gym events + M-9 order', () => {
  const body = { member_id: MEMBER_ID, event_id: EVENT_ID, reaction_type: 'fire' };
  const makeReq = () => jsonRequest('http://localhost/api/member/feed/react', body);

  it('DENY: event in another gym → 404, no reaction insert', async () => {
    const { admin, from, ops } = makeAdmin({
      gym_feed_events: [{ data: null }], // gym-scoped lookup misses
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await reactPOST(makeReq());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Event not found');

    // Lookup was gym-scoped; no reaction read/write happened
    expect(opsHas(ops, 'gym_feed_events', 'eq', 'gym_id', REAL_GYM)).toBe(true);
    expect(from).not.toHaveBeenCalledWith('feed_reactions');
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('M-9: verifyMember rejects → checkRateLimit is never called', async () => {
    mockVerifyMember.mockResolvedValue(forbidden());

    const res = await reactPOST(makeReq());
    expect(res.status).toBe(403);
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it('ALLOW: event in own gym → 200 toggled on', async () => {
    const { admin } = makeAdmin({
      gym_feed_events: [{ data: { id: EVENT_ID, member_id: null, gym_id: REAL_GYM } }],
      feed_reactions: [
        { data: null }, // existing-reaction check
        { error: null }, // insert
      ],
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await reactPOST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ toggled: true, reaction_type: 'fire' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. POST /api/member/challenges/[challengeId]/join
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/member/challenges/[id]/join — cross-gym challenges', () => {
  const makeReq = () =>
    jsonRequest(`http://localhost/api/member/challenges/${CHALLENGE_ID}/join`, {
      member_id: MEMBER_ID,
      gym_id: EVIL_GYM, // ignored — gym derived from member row
    });
  const makeParams = () => ({ params: Promise.resolve({ challengeId: CHALLENGE_ID }) });

  it('DENY: cross-gym challenge → 404, no participant insert', async () => {
    const { admin, from, ops } = makeAdmin({
      gym_challenges: [{ data: null }], // gym-scoped lookup misses
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await joinPOST(makeReq(), makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Challenge not found');

    expect(opsHas(ops, 'gym_challenges', 'eq', 'gym_id', REAL_GYM)).toBe(true);
    expect(from).not.toHaveBeenCalledWith('challenge_participants');
  });

  it('ALLOW: own-gym challenge → 201; insert bound to REAL gym, not body gym_id', async () => {
    const { admin, ops } = makeAdmin({
      gym_challenges: [
        { data: { id: CHALLENGE_ID, title: 'Squat-tember', is_active: true, entry_mode: 'open' } },
      ],
      challenge_participants: [
        { data: null }, // already-joined check
        { count: 3 }, // participant count
        { error: null }, // insert
      ],
      gym_feed_events: [{ error: null }],
      challenge_milestone_log: [{ error: null }],
    });
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await joinPOST(makeReq(), makeParams());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, rank: 4 });

    // Tier gate consulted with the DERIVED gym id, not the body's EVIL_GYM
    expect(mockFeatureAccess).toHaveBeenCalledWith(REAL_GYM, 'challenges');

    const insert = ops.find(
      (o) => o.table === 'challenge_participants' && o.method === 'insert'
    );
    expect((insert?.args[0] as Record<string, unknown>).gym_id).toBe(REAL_GYM);
    expect(noArgMentions(ops, EVIL_GYM)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. GET /api/machine/[machineId]/leaderboard
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/machine/[id]/leaderboard — cross-gym machines', () => {
  const makeReq = (gymParam: string) =>
    new NextRequest(
      `http://localhost/api/machine/${MACHINE_ID}/leaderboard?gym_id=${gymParam}&member_id=${MEMBER_ID}`
    );
  const makeParams = () => ({ params: Promise.resolve({ machineId: MACHINE_ID }) });

  it('DENY: machine in another gym → 404, leaderboard never queried', async () => {
    const { admin } = makeAdmin();
    mockVerifyMember.mockResolvedValue(asAuth(admin));
    mockAssertInGym.mockResolvedValue(false);

    const res = await leaderboardGET(makeReq(EVIL_GYM), makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Machine not found');
    expect(mockAssertInGym).toHaveBeenCalledWith(admin, 'machines', MACHINE_ID, REAL_GYM);
    expect(mockLeaderboard).not.toHaveBeenCalled();
  });

  it('ALLOW: own-gym machine → 200; leaderboard scoped to REAL gym, query param ignored', async () => {
    const { admin } = makeAdmin();
    mockVerifyMember.mockResolvedValue(asAuth(admin));
    mockLeaderboard.mockResolvedValue([]);

    const res = await leaderboardGET(makeReq(EVIL_GYM), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [] });
    expect(mockLeaderboard).toHaveBeenCalledWith(MACHINE_ID, REAL_GYM, MEMBER_ID, 10, admin);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. GET /api/tips
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/tips — member ownership gates the AI path', () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    // Authenticated user exists (route-level auth) — ownership enforced by verifyMember
    mockServerClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  const makeReq = () =>
    new NextRequest(
      `http://localhost/api/tips?member_id=${MEMBER_ID}&machine_id=${MACHINE_ID}`
    );

  it('DENY: caller does not own member_id → 403, no Gemini call, no cache read', async () => {
    const { admin, from } = makeAdmin();
    mockCreateClient.mockReturnValue(admin);
    mockVerifyMember.mockResolvedValue(forbidden());

    const res = await tipsGET(makeReq());
    expect(res.status).toBe(403);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('machines');
    expect(from).not.toHaveBeenCalledWith('ai_tip_cache');
  });

  it('ALLOW: owned member, machine outside gym → skips AI, falls to static tip', async () => {
    const { admin, from, ops } = makeAdmin({
      machines: [{ data: null }], // gym-scoped lookup misses → no AI generation
      ai_tip_cache: [{ data: null }],
    });
    mockCreateClient.mockReturnValue(admin);
    mockVerifyMember.mockResolvedValue(asAuth(admin));

    const res = await tipsGET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('static');
    expect(typeof json.tip).toBe('string');

    // Machine lookup was scoped to the member's gym; no edge-function spend
    expect(from).toHaveBeenCalledWith('machines');
    expect(opsHas(ops, 'machines', 'eq', 'gym_id', REAL_GYM)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ALLOW: owned member + own-gym machine → AI path; edge-fn payload carries the DERIVED gym', async () => {
    const { admin, ops } = makeAdmin({
      machines: [
        { data: { name: 'Bench Press Station', category: 'strength', muscle_groups: ['chest'] } },
      ],
    });
    mockCreateClient.mockReturnValue(admin);
    mockVerifyMember.mockResolvedValue(asAuth(admin));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tip_text: 'Retract your shoulder blades.', cached: false } }),
    });

    const res = await tipsGET(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tip: 'Retract your shoulder blades.',
      source: 'ai_generated',
    });

    // Machine lookup gym-scoped to the member's REAL gym
    expect(opsHas(ops, 'machines', 'eq', 'gym_id', REAL_GYM)).toBe(true);

    // The edge-function request BODY is bound to the derived gym — a caller
    // can never steer paid AI generation into another tenant.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.action).toBe('coaching_tip');
    expect(payload.payload.gym_id).toBe(REAL_GYM);
    expect(payload.payload.member_id).toBe(MEMBER_ID);
    expect(payload.payload.machine_id).toBe(MACHINE_ID);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. PATCH /api/ai/programs/[programId]
// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/ai/programs/[id] — staff gym binding', () => {
  const makeReq = () =>
    jsonRequest(
      `http://localhost/api/ai/programs/${PROGRAM_ID}`,
      { program_data: { days: [] } },
      'PATCH'
    );
  const makeParams = () => ({ params: Promise.resolve({ programId: PROGRAM_ID }) });

  it('DENY: program belongs to another gym → 404, no update', async () => {
    const { admin, ops } = makeAdmin({ ai_programs: [{ data: null }] });
    mockVerifyStaff.mockResolvedValue(asStaff(admin));

    const res = await programPATCH(makeReq(), makeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Program not found');

    expect(opsHas(ops, 'ai_programs', 'eq', 'gym_id', REAL_GYM)).toBe(true);
    expect(ops.some((o) => o.method === 'update')).toBe(false);
  });

  it('ALLOW: own-gym program → 200; update stays gym-scoped', async () => {
    const { admin, ops } = makeAdmin({
      ai_programs: [
        { data: { id: PROGRAM_ID } }, // ownership check
        { error: null }, // update
      ],
    });
    mockVerifyStaff.mockResolvedValue(asStaff(admin));

    const res = await programPATCH(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // Both the SELECT and the UPDATE chains carry the staff gym filter
    const gymScopedEqs = ops.filter(
      (o) => o.table === 'ai_programs' && o.method === 'eq' && o.args[0] === 'gym_id' && o.args[1] === REAL_GYM
    );
    expect(gymScopedEqs.length).toBe(2);
    expect(ops.some((o) => o.table === 'ai_programs' && o.method === 'update')).toBe(true);
  });
});
