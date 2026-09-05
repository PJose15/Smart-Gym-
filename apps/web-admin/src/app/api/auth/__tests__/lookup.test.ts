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

// ─── Admin client mock ────────────────────────────────────
let memberRow: Record<string, unknown> | null = null;
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockImplementation(async () => ({ data: memberRow, error: null })),
    }),
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
});

test('returning member → exactly { path, firstName }, no PII extras', async () => {
  memberRow = {
    user_id: 'user-1',
    display_name: 'Alice Smith',
    first_name: 'Alice',
  };

  const res = await POST(makeRequest('1.2.3.4'));
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;

  expect(body).toEqual({ path: 'returning', firstName: 'Alice' });
  expect(Object.keys(body).sort()).toEqual(['firstName', 'path']);
});

test('preloaded member (no user_id) → { path: preloaded, firstName }', async () => {
  memberRow = {
    user_id: null,
    display_name: 'Bob Jones',
    first_name: 'Bob',
  };

  const res = await POST(makeRequest('1.2.3.4'));
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;

  expect(body).toEqual({ path: 'preloaded', firstName: 'Bob' });
});

test('firstName falls back to first word of display_name', async () => {
  memberRow = {
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

test('rate limit keyed on first-hop IP + phone', async () => {
  memberRow = null;

  await POST(makeRequest('9.8.7.6, 10.0.0.1'));
  expect(mockCheckRateLimit).toHaveBeenCalledWith(
    `lookup:9.8.7.6:${PHONE}`,
    20,
    300_000
  );
});

test('missing x-forwarded-for → keyed as unknown, still limited', async () => {
  memberRow = null;

  const res = await POST(makeRequest());
  expect(res.status).toBe(200);
  expect(mockCheckRateLimit).toHaveBeenCalledWith(
    `lookup:unknown:${PHONE}`,
    20,
    300_000
  );

  // 429 propagates
  mockCheckRateLimit.mockReturnValue(
    new (await import('next/server')).NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429 }
    )
  );
  const limited = await POST(makeRequest());
  expect(limited.status).toBe(429);
});
