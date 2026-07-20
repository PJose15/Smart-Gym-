/**
 * @jest-environment node
 *
 * Tests for POST /api/cron/agent-daily
 *
 * Covers AGENT-04 daily cron:
 *  - Auth: both header forms (x-smartgym-internal-key + Authorization Bearer)
 *  - Scan 1: dormant members (member-inactive-14d → retention-agent)
 *  - Scan 2: checkin SLA overdue (checkin-sla-overdue → operations-agent)
 *  - Scan 3: machine underutilization (machine-underutilized → operations-agent)
 *  - Scan 4: challenge auto-expiry (challenge-ended → growth-agent + is_active=false)
 *  - Batching resilience: one trigger rejecting does not fail the route
 *  - Empty scans: 200 with all counters 0, no trigger calls
 */

import { NextRequest } from 'next/server';

// ─── Mock triggerUptimizeAIAgent ──────────────────────────
const mockTriggerAgent = jest.fn();
jest.mock('@/lib/billing/triggerAgent', () => ({
  triggerUptimizeAIAgent: (...args: unknown[]) => mockTriggerAgent(...args),
}));

// ─── Mock dispatcher (resolveOwnerProfileId + sendNotification) ──────────────
const mockResolveOwnerProfileId = jest.fn();
const mockSendNotification = jest.fn();
jest.mock('@/lib/notifications/dispatcher', () => ({
  resolveOwnerProfileId: (...args: unknown[]) => mockResolveOwnerProfileId(...args),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// ─── Supabase mock ─────────────────────────────────────────
// Per-table canned data:
let mockMembersData: Array<{ id: string; gym_id: string }> = [];
let mockCheckinsData: Array<{ id: string; member_id: string; gym_id: string }> = [];
let mockMachinesData: Array<{ id: string; gym_id: string }> = [];
let mockScanEventsData: Array<{ machine_id: string }> = [];
let mockChallengesData: Array<{ id: string; gym_id: string }> = [];
let mockParticipantsData: Array<{ member_id: string }> = [];

// For gym_challenges update
const mockChallengeUpdateEq = jest.fn().mockResolvedValue({ error: null });
const mockChallengeUpdate = jest.fn(() => ({ eq: mockChallengeUpdateEq }));

function buildTableChain(table: string) {
  if (table === 'members') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: jest.fn().mockResolvedValue({ data: mockMembersData, error: null }),
        })),
      })),
    };
  }
  if (table === 'weekly_checkins') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            not: jest.fn(() => ({
              lt: jest.fn().mockResolvedValue({ data: mockCheckinsData, error: null }),
            })),
          })),
        })),
      })),
    };
  }
  if (table === 'machines') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: mockMachinesData, error: null }),
      })),
    };
  }
  if (table === 'machine_scan_events') {
    return {
      select: jest.fn(() => ({
        // Route queries: .select('machine_id').gte('scanned_at', sevenDaysAgo)
        gte: jest.fn().mockResolvedValue({ data: mockScanEventsData, error: null }),
        // Also support optional .eq() chaining for gym filtering
        eq: jest.fn(() => ({
          gte: jest.fn().mockResolvedValue({ data: mockScanEventsData, error: null }),
        })),
      })),
    };
  }
  if (table === 'gym_challenges') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: jest.fn().mockResolvedValue({ data: mockChallengesData, error: null }),
        })),
      })),
      update: mockChallengeUpdate,
    };
  }
  if (table === 'challenge_participants') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: mockParticipantsData, error: null }),
      })),
    };
  }
  return {};
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => buildTableChain(table)),
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
  return new NextRequest('http://localhost/api/cron/agent-daily', {
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
  // Reset env
  process.env.INTERNAL_WEBHOOK_KEY = 'test-cron-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

  // Reset per-table canned data
  mockMembersData = [];
  mockCheckinsData = [];
  mockMachinesData = [];
  mockScanEventsData = [];
  mockChallengesData = [];
  mockParticipantsData = [];

  // Default: triggerAgent returns success
  mockTriggerAgent.mockResolvedValue({ success: true });

  // Default: dispatcher returns success
  mockResolveOwnerProfileId.mockResolvedValue('owner-profile-uuid');
  mockSendNotification.mockResolvedValue('sent');
});

// ─── Auth tests ───────────────────────────────────────────
describe('POST /api/cron/agent-daily — auth', () => {
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

// ─── Scan 1: dormant members ──────────────────────────────
describe('POST /api/cron/agent-daily — dormant member scan', () => {
  test('2 dormant members → triggerUptimizeAIAgent called twice with retention-agent member-inactive-14d', async () => {
    mockMembersData = [
      { id: 'member-1', gym_id: 'gym-a' },
      { id: 'member-2', gym_id: 'gym-b' },
    ];

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dormant_triggered).toBe(2);

    expect(mockTriggerAgent).toHaveBeenCalledWith('retention-agent', {
      event: 'member-inactive-14d',
      gym_id: 'gym-a',
      member_id: 'member-1',
      is_agent_initiated: false,
    });
    expect(mockTriggerAgent).toHaveBeenCalledWith('retention-agent', {
      event: 'member-inactive-14d',
      gym_id: 'gym-b',
      member_id: 'member-2',
      is_agent_initiated: false,
    });
  });
});

// ─── Scan 2: checkin SLA ──────────────────────────────────
describe('POST /api/cron/agent-daily — checkin SLA scan', () => {
  test('1 overdue check-in → operations-agent checkin-sla-overdue with dedup_key = checkin id', async () => {
    mockCheckinsData = [
      { id: 'checkin-99', member_id: 'member-3', gym_id: 'gym-c' },
    ];

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checkins_triggered).toBe(1);

    expect(mockTriggerAgent).toHaveBeenCalledWith('operations-agent', {
      event: 'checkin-sla-overdue',
      gym_id: 'gym-c',
      member_id: 'member-3',
      dedup_key: 'checkin-99',
      is_agent_initiated: false,
    });
  });
});

// ─── Empty scans ──────────────────────────────────────────
describe('POST /api/cron/agent-daily — empty scans', () => {
  test('all scans return empty → 200 with all counters 0, no trigger calls', async () => {
    // All mock data arrays remain empty (set in beforeEach)
    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dormant_triggered).toBe(0);
    expect(body.checkins_triggered).toBe(0);
    expect(body.machines_triggered).toBe(0);
    expect(body.challenges_expired).toBe(0);
    expect(mockTriggerAgent).not.toHaveBeenCalled();
  });
});

// ─── Batching resilience ──────────────────────────────────
describe('POST /api/cron/agent-daily — batching resilience', () => {
  test('one trigger rejecting does not fail the route (Promise.allSettled)', async () => {
    mockMembersData = [
      { id: 'member-ok', gym_id: 'gym-a' },
      { id: 'member-fail', gym_id: 'gym-b' },
    ];

    mockTriggerAgent
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Trigger network error'));

    const req = makeRequest('test-cron-key');
    const res = await POST(req);

    // Route must not throw; 200 returned
    expect(res.status).toBe(200);
  });
});

// ─── Scan 3: machine underutilization ────────────────────
describe('POST /api/cron/agent-daily — machine underutilization scan', () => {
  test('3 machines, 1 has recent scan → operations-agent fired for exactly the 2 unscanned', async () => {
    mockMachinesData = [
      { id: 'machine-1', gym_id: 'gym-a' },
      { id: 'machine-2', gym_id: 'gym-a' },
      { id: 'machine-3', gym_id: 'gym-a' },
    ];
    // machine-2 was recently scanned
    mockScanEventsData = [
      { machine_id: 'machine-2' },
    ];

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.machines_triggered).toBe(2);

    // machine-1 and machine-3 must be triggered
    expect(mockTriggerAgent).toHaveBeenCalledWith('operations-agent', expect.objectContaining({
      event: 'machine-underutilized',
      machine_id: 'machine-1',
      gym_id: 'gym-a',
      dedup_key: 'machine-1',
      is_agent_initiated: false,
    }));
    expect(mockTriggerAgent).toHaveBeenCalledWith('operations-agent', expect.objectContaining({
      event: 'machine-underutilized',
      machine_id: 'machine-3',
      gym_id: 'gym-a',
      dedup_key: 'machine-3',
      is_agent_initiated: false,
    }));

    // machine-2 must NOT be triggered
    const triggerCalls = mockTriggerAgent.mock.calls as Array<[string, Record<string, unknown>]>;
    const machineTriggers = triggerCalls.filter(
      ([, payload]) => payload.event === 'machine-underutilized'
    );
    const triggeredMachineIds = machineTriggers.map(([, p]) => p.machine_id);
    expect(triggeredMachineIds).not.toContain('machine-2');
  });
});

// ─── Scan 4: challenge auto-expiry ───────────────────────
describe('POST /api/cron/agent-daily — challenge auto-expiry scan', () => {
  test('1 active expired challenge → is_active set false + growth-agent challenge-ended with auto_expired: true', async () => {
    mockChallengesData = [
      { id: 'challenge-7', gym_id: 'gym-d' },
    ];

    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.challenges_expired).toBe(1);

    // Update called to deactivate
    expect(mockChallengeUpdate).toHaveBeenCalledWith({ is_active: false });
    expect(mockChallengeUpdateEq).toHaveBeenCalledWith('id', 'challenge-7');

    // Agent fired with correct payload
    expect(mockTriggerAgent).toHaveBeenCalledWith('growth-agent', {
      event: 'challenge-ended',
      gym_id: 'gym-d',
      challenge_id: 'challenge-7',
      dedup_key: 'challenge-7',
      auto_expired: true,
      is_agent_initiated: false,
    });
  });

  test('response includes machines_triggered and challenges_expired counters', async () => {
    const req = makeRequest('test-cron-key');
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('machines_triggered');
    expect(body).toHaveProperty('challenges_expired');
  });
});
