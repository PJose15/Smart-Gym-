/**
 * @jest-environment node
 *
 * BE-H6 — pre-auth phone lookup must return ONLY { path, firstName? }
 * (no ids, phone, display_name, goals, or other member PII) and must be
 * rate-limited on IP+phone.
 */

import { NextRequest } from 'next/server';

// ─── Mock rateLimit (capture keys) ────────────────────────
const mockCheckRateLimit = jest.fn().mockReturnValue(null);
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: (key: string, max: number, ms: number) =>
    mockCheckRateLimit(key, max, ms),
}));

// ─── Admin client mock (captures select/eq args) ──────────
let memberRow: Record<string, unknown> | null = null;
const mockSelectCalls: unknown[] = [];
const mockEqCalls: Array<[unknown, unknown]> = [];
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = jest.fn((cols: unknown) => {
        mockSelectCalls.push(cols);
        return chain;
      });
      chain.eq = jest.fn((col: unknown, val: unknown) => {
        mockEqCalls.push([col, val]);
        return chain;
      });
      chain.maybeSingle = jest
        .fn()
        .mockImplementation(async () => ({ data: memberRow, error: null }));
      return chain;
    },
  })),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

const GYM_ID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
const PHONE = '+15551234567';

// A FULL member row — if the route (or a future edit) ever spreads/echoes the
// row instead of building the minimal payload, every extra field materializes
// here and the exact `toEqual` shape assertions below fail.
const FULL_MEMBER_ROW = {
  id: 'f0e1d2c3-b4a5-4968-8788-990a0b0c0d0e',
  gym_id: GYM_ID,
  user_id: 'user-1',
  phone: PHONE,
  email: 'alice@example.com',
  display_name: 'Alice Smith',
  first_name: 'Alice',
  primary_goal: 'strength',
  experience_level: 'intermediate',
  smartgym_score: 88,
  current_streak: 7,
  assigned_trainer_id: 'trainer-1',
  onboarding_status: 'active',
  is_active: true,
};

function makeRequest(ip?: string) {
  return new NextRequest('http://localhost/api/auth/lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify({ phone: PHONE, gym_id: GYM_ID }),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../lookup/route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(null);
  memberRow = null;
  mockSelectCalls.length = 0;
  mockEqCalls.length = 0;
});

test('returning member → exactly { path, firstName }, no PII extras', async () => {
  memberRow = { ...FULL_MEMBER_ROW };

  const res = await POST(makeRequest('1.2.3.4'));
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;

  expect(body).toEqual({ path: 'returning', firstName: 'Alice' });
  expect(Object.keys(body).sort()).toEqual(['firstName', 'path']);
});

test('query selects ONLY minimal columns and filters on (gym_id, phone, is_active)', async () => {
  memberRow = { ...FULL_MEMBER_ROW };

  await POST(makeRequest('1.2.3.4'));

  // Exactly one select, with exactly the minimal column list
  expect(mockSelectCalls).toEqual(['user_id, display_name, first_name']);
  // Filter triple, in order — gym-scoped, phone-matched, active-only
  expect(mockEqCalls).toEqual([
    ['gym_id', GYM_ID],
    ['phone', PHONE],
    ['is_active', true],
  ]);
});

test('preloaded member (no user_id) → { path: preloaded, firstName }', async () => {
  memberRow = {
    ...FULL_MEMBER_ROW,
    user_id: null,
    display_name: 'Bob Jones',
    first_name: 'Bob',
    email: 'bob@example.com',
  };

  const res = await POST(makeRequest('1.2.3.4'));
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;

  expect(body).toEqual({ path: 'preloaded', firstName: 'Bob' });
});

test('firstName falls back to first word of display_name', async () => {
  memberRow = {
    ...FULL_MEMBER_ROW,
    user_id: 'user-2',
    display_name: 'Carol White',
    first_name: null,
  };

  const res = await POST(makeRequest('1.2.3.4'));
  const body = (await res.json()) as Record<string, unknown>;
  expect(body).toEqual({ path: 'returning', firstName: 'Carol' });
});

test('no match → { path: cold } only', async () => {
  memberRow = null;

  const res = await POST(makeRequest('1.2.3.4'));
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body).toEqual({ path: 'cold' });
});

test('rate limited twice: overall per-IP cap first, then per-IP+phone (first-hop IP)', async () => {
  memberRow = null;

  await POST(makeRequest('9.8.7.6, 10.0.0.1'));
  // Exactly two limits, in this order, with these keys/caps/windows
  expect(mockCheckRateLimit.mock.calls).toEqual([
    ['lookup-ip:9.8.7.6', 30, 300_000],
    [`lookup:9.8.7.6:${PHONE}`, 20, 300_000],
  ]);
});

test('missing x-forwarded-for → keyed as unknown, still limited', async () => {
  memberRow = null;

  const res = await POST(makeRequest());
  expect(res.status).toBe(200);
  expect(mockCheckRateLimit.mock.calls).toEqual([
    ['lookup-ip:unknown', 30, 300_000],
    [`lookup:unknown:${PHONE}`, 20, 300_000],
  ]);

  // 429 from the overall per-IP cap propagates AND short-circuits the
  // per-phone check (only one rateLimit call happens)
  mockCheckRateLimit.mockReset();
  mockCheckRateLimit.mockReturnValue(
    new (await import('next/server')).NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429 }
    )
  );
  const limited = await POST(makeRequest());
  expect(limited.status).toBe(429);
  expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
  expect(mockCheckRateLimit).toHaveBeenCalledWith('lookup-ip:unknown', 30, 300_000);
});
