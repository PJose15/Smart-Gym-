/**
 * Tests for GET /api/owner/at-risk
 * Verifies per-member retention-agent firing (never once per request).
 */

import { NextResponse } from 'next/server';
import { GET } from '../route';

// ─── Mocks ───────────────────────────────────────────────

jest.mock('@/lib/auth/verifyStaff');
jest.mock('@/lib/agents/atRiskScan');
jest.mock('@/lib/billing/triggerAgent');

import { verifyStaff } from '@/lib/auth/verifyStaff';
import { fetchGymAtRiskMembers } from '@/lib/agents/atRiskScan';
import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';

const mockVerifyStaff = verifyStaff as jest.MockedFunction<typeof verifyStaff>;
const mockFetchAtRisk = fetchGymAtRiskMembers as jest.MockedFunction<typeof fetchGymAtRiskMembers>;
const mockTrigger = triggerUptimizeAIAgent as jest.MockedFunction<typeof triggerUptimizeAIAgent>;

const MOCK_ADMIN = {} as ReturnType<typeof import('@supabase/supabase-js').createClient>;
const GYM_ID = 'gym-test-001';

const AT_RISK_MEMBERS = [
  { profileId: 'member-001', memberName: 'Alice', reasons: [{ type: 'no_workouts_7d' as const, daysSinceLastWorkout: 10 }] },
  { profileId: 'member-002', memberName: 'Bob', reasons: [{ type: 'no_workouts_7d' as const, daysSinceLastWorkout: 14 }] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyStaff.mockResolvedValue({ admin: MOCK_ADMIN, gym_id: GYM_ID } as Awaited<ReturnType<typeof verifyStaff>>);
  mockTrigger.mockResolvedValue({ success: true });
});

// ─── Tests ───────────────────────────────────────────────

describe('GET /api/owner/at-risk', () => {
  it('fires retention-agent member-at-risk ONCE PER at-risk member with correct payload', async () => {
    mockFetchAtRisk.mockResolvedValue(AT_RISK_MEMBERS);

    const response = await GET();
    const body = await response.json();

    // Two members → two separate agent calls
    expect(mockTrigger).toHaveBeenCalledTimes(2);

    // First call: member-001
    expect(mockTrigger).toHaveBeenCalledWith('retention-agent', {
      event: 'member-at-risk',
      gym_id: GYM_ID,
      member_id: 'member-001',
      is_agent_initiated: false,
    });

    // Second call: member-002
    expect(mockTrigger).toHaveBeenCalledWith('retention-agent', {
      event: 'member-at-risk',
      gym_id: GYM_ID,
      member_id: 'member-002',
      is_agent_initiated: false,
    });

    // member_id is never null (Pitfall 4)
    const calls = mockTrigger.mock.calls;
    calls.forEach(([, payload]) => {
      expect(payload.member_id).not.toBeNull();
      expect(payload.member_id).not.toBeUndefined();
    });
  });

  it('does NOT fire any agent call when there are 0 at-risk members', async () => {
    mockFetchAtRisk.mockResolvedValue([]);

    await GET();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('returns exactly the AtRiskMember[] array (unchanged contract)', async () => {
    mockFetchAtRisk.mockResolvedValue(AT_RISK_MEMBERS);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(AT_RISK_MEMBERS);
  });

  it('returns 200 even when a trigger call rejects', async () => {
    mockFetchAtRisk.mockResolvedValue([AT_RISK_MEMBERS[0]]);
    mockTrigger.mockRejectedValue(new Error('network failure'));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([AT_RISK_MEMBERS[0]]);
  });
});
