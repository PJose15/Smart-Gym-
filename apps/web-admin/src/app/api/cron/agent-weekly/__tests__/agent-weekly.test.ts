/**
 * @jest-environment node
 *
 * Tests for POST /api/cron/agent-weekly
 *
 * Covers AGENT-04 weekly cron:
 *  - Auth: both header forms (x-smartgym-internal-key + Authorization Bearer)
 *  - Gym with active members → operations-agent fired with weekly-summary
 *  - Gym with 0 active members → NO weekly-summary fire (suppressed)
 *  - fetchGymAtRiskMembers returns 2 at-risk → retention-agent fired per member
 *  - Response counters: summaries_triggered, at_risk_triggered, gyms_scanned
 *  - One gym's scan throwing does not abort remaining gyms (allSettled)
 */

import { NextRequest } from 'next/server';

// ─── Mock triggerUptimizeAIAgent ──────────────────────────
const mockTriggerAgent = jest.fn();
jest.mock('@/lib/billing/triggerAgent', () => ({
  triggerUptimizeAIAgent: (...args: unknown[]) => mockTriggerAgent(...args),
}));

// ─── Mock fetchGymAtRiskMembers ───────────────────────────
const mockFetchAtRisk = jest.fn();
jest.mock('@/lib/agents/atRiskScan', () => ({
  fetchGymAtRiskMembers: (...args: unknown[]) => mockFetchAtRisk(...args),
}));

// ─── Supabase mock ─────────────────────────────────────────
// Per-table data seeded per test:
let mockGymsData: Array<{ id: string; name: string }> = [];

// Per-gym active member count
const mockMemberCounts: Record<string, number> = {};

// Per-gym session count
const mockSessionCounts: Record<string, number> = {};

// Supabase .count() head query returns { count: N }
function buildGymTableChain(table: string) {
  if (table === 'gyms') {
    return {
      select: jest.fn(() => ({
        neq: jest.fn().mockResolvedValue({ data: mockGymsData, error: null }),
      })),
    };
  }
  if (table === 'members') {
    // Head count query: .select('id', { head: true, count: 'exact' }).eq('gym_id', ...).eq('status', 'active')
    return {
      select: jest.fn(() => ({
        eq: jest.fn((col: string, val: string) => {
          if (col === 'gym_id') {
            return {
              eq: jest.fn().mockResolvedValue({ count: mockMemberCounts[val] ?? 0, error: null }),
            };
          }
          return {
            eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
          };
        }),
      })),
    };
  }
  if (table === 'workout_sessions') {
    // Head count query: .select('id', { head: true, count: 'exact' }).eq('gym_id', ...).gte('created_at', ...)
    return {
      select: jest.fn(() => ({
        eq: jest.fn((col: string, val: string) => {
          if (col === 'gym_id') {
            return {
              gte: jest.fn().mockResolvedValue({ count: mockSessionCounts[val] ?? 0, error: null }),
            };
          }
          return {
            gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
          };
        }),
      })),
    };
  }
  return {};
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => buildGymTableChain(table)),
  })),
}));

// ─── Helpers ───────────────────────────────────────────────
function makeRequest(key?: string, useBearer = false) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key !== undefined) {
    if (useBearer) {
      headers['authorization'] = `Bearer ${key}`;
    } else {
      headers['x-smartgym-internal-key'] = key;
    }
  }
  return new NextRequest('http://localhost/api/cron/agent-weekly', {
    method: 'POST',
    headers,
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.INTERNAL_WEBHOOK_KEY = 'test-cron-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

  // Reset per-test data
  mockGymsData = [];
  Object.keys(mockMemberCounts).forEach(k => delete mockMemberCounts[k]);
  Object.keys(mockSessionCounts).forEach(k => delete mockSessionCounts[k]);

  mockTriggerAgent.mockResolvedValue({ success: true });
  mockFetchAtRisk.mockResolvedValue([]);
});

// ─── Auth tests ───────────────────────────────────────────
describe('POST /api/cron/agent-weekly — auth', () => {
  test('no key header → 401', async () => {
    const req = makeRequest(undefined);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('wrong key → 401', async () => {
    const req = makeRequest('wrong-key');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('valid x-smartgym-internal-key → 200', async () => {
    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test('valid Authorization Bearer → 200', async () => {
    const req = makeRequest('test-cron-key', true);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ─── Weekly summary scan ──────────────────────────────────
describe('POST /api/cron/agent-weekly — weekly summary', () => {
  test('gym with 12 active members + 30 sessions → operations-agent weekly-summary fired', async () => {
    mockGymsData = [{ id: 'gym-active', name: 'Active Gym' }];
    mockMemberCounts['gym-active'] = 12;
    mockSessionCounts['gym-active'] = 30;

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summaries_triggered).toBe(1);

    expect(mockTriggerAgent).toHaveBeenCalledWith('operations-agent', {
      event: 'weekly-summary',
      gym_id: 'gym-active',
      active_members: 12,
      sessions_7d: 30,
      is_agent_initiated: false,
    });
  });

  test('gym with 0 active members → NO weekly-summary fire (suppressed)', async () => {
    mockGymsData = [{ id: 'gym-empty', name: 'Empty Gym' }];
    mockMemberCounts['gym-empty'] = 0;

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summaries_triggered).toBe(0);

    // weekly-summary must NOT be fired for this zero-member gym
    const summaryCall = mockTriggerAgent.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>)?.event === 'weekly-summary'
    );
    expect(summaryCall).toBeUndefined();
  });
});

// ─── At-risk early warning scan ───────────────────────────
describe('POST /api/cron/agent-weekly — at-risk early warning', () => {
  test('fetchGymAtRiskMembers returns 2 at-risk → retention-agent member-at-risk fired per member', async () => {
    const GYM_ID = 'gym-with-risks';
    mockGymsData = [{ id: GYM_ID, name: 'Risky Gym' }];
    mockMemberCounts[GYM_ID] = 5;
    mockSessionCounts[GYM_ID] = 10;

    mockFetchAtRisk.mockResolvedValue([
      { profileId: 'at-risk-1', memberName: 'Alice', reasons: [{ type: 'no_workouts_7d', daysSinceLastWorkout: 10 }] },
      { profileId: 'at-risk-2', memberName: 'Bob', reasons: [{ type: 'no_workouts_7d', daysSinceLastWorkout: 15 }] },
    ]);

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.at_risk_triggered).toBe(2);

    // Per-member calls with member_id set (never null)
    expect(mockTriggerAgent).toHaveBeenCalledWith('retention-agent', {
      event: 'member-at-risk',
      gym_id: GYM_ID,
      member_id: 'at-risk-1',
      is_agent_initiated: false,
    });
    expect(mockTriggerAgent).toHaveBeenCalledWith('retention-agent', {
      event: 'member-at-risk',
      gym_id: GYM_ID,
      member_id: 'at-risk-2',
      is_agent_initiated: false,
    });
  });
});

// ─── Response counters ────────────────────────────────────
describe('POST /api/cron/agent-weekly — response counters', () => {
  test('response includes summaries_triggered, at_risk_triggered, gyms_scanned', async () => {
    mockGymsData = [{ id: 'gym-1', name: 'Gym 1' }];
    mockMemberCounts['gym-1'] = 3;
    mockSessionCounts['gym-1'] = 5;

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('summaries_triggered');
    expect(body).toHaveProperty('at_risk_triggered');
    expect(body).toHaveProperty('gyms_scanned');
  });
});

// ─── allSettled resilience ────────────────────────────────
describe('POST /api/cron/agent-weekly — allSettled resilience', () => {
  test('one gym scan throwing does not abort remaining gyms', async () => {
    mockGymsData = [
      { id: 'gym-ok', name: 'OK Gym' },
      { id: 'gym-fail', name: 'Fail Gym' },
    ];
    mockMemberCounts['gym-ok'] = 3;
    mockMemberCounts['gym-fail'] = 5;
    mockSessionCounts['gym-ok'] = 2;
    mockSessionCounts['gym-fail'] = 8;

    // Make fetchGymAtRiskMembers throw for the second gym
    mockFetchAtRisk
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('DB timeout for gym-fail'));

    const req = makeRequest('test-cron-key');
    const res = await POST(req);

    // Route must not throw; 200 returned
    expect(res.status).toBe(200);
    // gym-ok still processed
    expect(mockTriggerAgent).toHaveBeenCalledWith('operations-agent', expect.objectContaining({
      event: 'weekly-summary',
      gym_id: 'gym-ok',
    }));
  });
});
