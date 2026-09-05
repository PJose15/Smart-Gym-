/**
 * @jest-environment node
 *
 * Tests for POST /api/sessions/pr-check — enriched PR feed events.
 *
 * pr-check is the single OWNER of pr_weight / pr_volume feed events
 * (feedGenerator no longer produces them). These tests pin down:
 *   - enriched context_data (best_weight_lbs / volume_lbs, machine_name,
 *     pr_type, previous_best_lbs, improvement_pct) so formatFeedEvent can
 *     rebuild descriptions in the viewer's weight unit
 *   - display_text convention (lbs-baked fallback, no member-name prefix)
 *   - one-PR-event-per-member-per-day dedupe with in-place upgrade
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockVerifyMember = jest.fn();
jest.mock('@/lib/auth/verifyMember', () => ({
  verifyMember: (...args: unknown[]) => mockVerifyMember(...args),
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));

// ─── Chainable query mock ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
interface QueryResult { data?: unknown; error?: unknown }

function makeChain(result: QueryResult = { data: null }) {
  const chain: any = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'order', 'limit', 'update', 'insert']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function makeAdmin(queues: Record<string, any[]>) {
  return {
    from: jest.fn((table: string) => {
      const q = queues[table];
      if (!q || q.length === 0) throw new Error(`Unexpected from('${table}')`);
      return q.shift();
    }),
  };
}

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const MEMBER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const MACHINE_ID = 'cccccccc-0000-0000-0000-000000000003';
const GYM_ID = 'dddddddd-0000-0000-0000-000000000004';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/sessions/pr-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: SESSION_ID,
      member_id: MEMBER_ID,
      machine_id: MACHINE_ID,
      ...body,
    }),
  });
}

let POST: (req: NextRequest) => Promise<NextResponse>;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(null);
});

const HISTORY = [
  { id: 'h-1', best_weight_lbs: 200, total_volume_lbs: 4000, session_date: '2026-09-01' },
];

describe('POST /api/sessions/pr-check feed events', () => {
  test('W1: weight PR inserts enriched pr_weight event', async () => {
    const insertChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 225, total_volume_lbs: 5000 } }),
        makeChain({ data: HISTORY }),          // history
        makeChain({}),                          // markPR update
        makeChain({ data: { gym_id: GYM_ID } }),// gym lookup
      ],
      machines: [makeChain({ data: { name: 'Chest Press' } })],
      gym_feed_events: [makeChain({ data: [] }), insertChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 225, reps: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pr).toEqual({
      type: 'weight',
      value: 225,
      previousValue: 200,
      improvementPct: 12.5,
    });

    expect(insertChain.insert).toHaveBeenCalledTimes(1);
    const payload = insertChain.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      gym_id: GYM_ID,
      member_id: MEMBER_ID,
      event_type: 'pr_weight',
      display_text: 'hit a new personal best on Chest Press — 225 lbs!',
      priority: 'high',
    });
    expect(payload.context_data).toMatchObject({
      session_id: SESSION_ID,
      machine_id: MACHINE_ID,
      machine_name: 'Chest Press',
      pr_type: 'weight',
      best_weight_lbs: 225,
      previous_best_lbs: 200,
      improvement_pct: 12.5,
    });
  });

  test('W2: better same-day weight PR upgrades the existing event in place', async () => {
    const dedupeChain = makeChain({
      data: [{ id: 'evt-1', event_type: 'pr_weight', context_data: { best_weight_lbs: 210 } }],
    });
    const updateChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 225, total_volume_lbs: 5000 } }),
        makeChain({ data: HISTORY }),
        makeChain({}),
        makeChain({ data: { gym_id: GYM_ID } }),
      ],
      machines: [makeChain({ data: { name: 'Chest Press' } })],
      gym_feed_events: [dedupeChain, updateChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 225, reps: 5 }));
    expect(res.status).toBe(200);

    expect(updateChain.update).toHaveBeenCalledTimes(1);
    const payload = updateChain.update.mock.calls[0][0];
    expect(payload.event_type).toBe('pr_weight');
    expect(payload.context_data.best_weight_lbs).toBe(225);
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'evt-1');
    expect(updateChain.insert).not.toHaveBeenCalled();
  });

  test('W3: same-day event with a higher value is left alone (no insert/update)', async () => {
    const dedupeChain = makeChain({
      data: [{ id: 'evt-1', event_type: 'pr_weight', context_data: { best_weight_lbs: 250 } }],
    });
    const spareChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 225, total_volume_lbs: 5000 } }),
        makeChain({ data: HISTORY }),
        makeChain({}),
        makeChain({ data: { gym_id: GYM_ID } }),
      ],
      machines: [makeChain({ data: { name: 'Chest Press' } })],
      gym_feed_events: [dedupeChain, spareChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 225, reps: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pr.type).toBe('weight'); // still a PR response for the client

    expect(spareChain.insert).not.toHaveBeenCalled();
    expect(spareChain.update).not.toHaveBeenCalled();
  });

  test('V1: volume PR inserts enriched pr_volume event', async () => {
    const insertChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 150, total_volume_lbs: 6000 } }),
        makeChain({ data: HISTORY }),
        makeChain({}),
        makeChain({ data: { gym_id: GYM_ID } }),
      ],
      machines: [makeChain({ data: { name: 'Leg Press' } })],
      gym_feed_events: [makeChain({ data: [] }), insertChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 150, reps: 10 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pr.type).toBe('volume');

    const payload = insertChain.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      event_type: 'pr_volume',
      display_text: 'hit a volume PR on Leg Press — 6.0k lbs!',
      priority: 'medium',
    });
    expect(payload.context_data).toMatchObject({
      pr_type: 'volume',
      volume_lbs: 6000,
      previous_best_lbs: 4000,
      improvement_pct: 50,
      machine_name: 'Leg Press',
    });
    expect(payload.context_data.best_weight_lbs).toBeUndefined();
  });

  test('F1: first session inserts unit-free event and never upgrades an existing one', async () => {
    const insertChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 100, total_volume_lbs: 1000 } }),
        makeChain({ data: [] }), // no history → first_session
        makeChain({}),
        makeChain({ data: { gym_id: GYM_ID } }),
      ],
      machines: [makeChain({ data: { name: 'Chest Press' } })],
      gym_feed_events: [makeChain({ data: [] }), insertChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 100, reps: 8 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pr.type).toBe('first_session');

    const payload = insertChain.insert.mock.calls[0][0];
    expect(payload.event_type).toBe('pr_weight');
    expect(payload.display_text).toBe('logged a first session on Chest Press!');
    expect(payload.context_data.pr_type).toBe('first_session');
    // No unit-bearing number in context — clients pass display_text through
    expect(payload.context_data.best_weight_lbs).toBeUndefined();
  });

  test('F2: first session with an existing same-day PR event is skipped', async () => {
    const dedupeChain = makeChain({
      data: [{ id: 'evt-1', event_type: 'pr_weight', context_data: { best_weight_lbs: 250 } }],
    });
    const spareChain = makeChain({ error: null });
    const admin = makeAdmin({
      workout_sessions: [
        makeChain({ data: { id: SESSION_ID, best_weight_lbs: 100, total_volume_lbs: 1000 } }),
        makeChain({ data: [] }),
        makeChain({}),
        makeChain({ data: { gym_id: GYM_ID } }),
      ],
      machines: [makeChain({ data: { name: 'Chest Press' } })],
      gym_feed_events: [dedupeChain, spareChain],
    });
    mockVerifyMember.mockResolvedValue({ admin, member_id: MEMBER_ID });

    const res = await POST(makeRequest({ weight_lbs: 100, reps: 8 }));
    expect(res.status).toBe(200);
    expect(spareChain.insert).not.toHaveBeenCalled();
    expect(spareChain.update).not.toHaveBeenCalled();
  });
});
