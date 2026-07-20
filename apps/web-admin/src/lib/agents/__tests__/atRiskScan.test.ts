/**
 * Tests for fetchGymAtRiskMembers shared helper.
 * Mocks the Supabase admin client passed as a parameter.
 */

import { fetchGymAtRiskMembers } from '../atRiskScan';
import type { AtRiskMember } from '@nexera/ai-assist';

// ─── Mock admin client builder ───────────────────────────

function makeMockAdmin(membersData: unknown[], sessionsData: unknown[]) {
  // Chainable Supabase-like query builder
  const membersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: membersData, error: null }),
  };
  // Make eq chainable and return the chain with then
  membersChain.eq.mockImplementation(() => ({
    eq: jest.fn().mockImplementation(() => ({
      data: membersData,
      error: null,
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: membersData, error: null }),
    })),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: membersData, error: null }),
  }));

  const sessionsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockImplementation(() => ({
      data: sessionsData,
      error: null,
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: sessionsData, error: null }),
    })),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: sessionsData, error: null }),
  };

  const admin = {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'members') return makeFullMembersChain(membersData);
      if (table === 'workout_sessions') return makeFullSessionsChain(sessionsData);
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return admin;
}

/** Fully chainable members query returning Promise-like */
function makeFullMembersChain(data: unknown[]) {
  const terminal = {
    data,
    error: null,
    then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
  };
  const chain2: Record<string, unknown> = { ...terminal, eq: jest.fn(() => terminal) };
  const chain1: Record<string, unknown> = { ...terminal, eq: jest.fn(() => chain2) };
  return { select: jest.fn(() => chain1) };
}

/** Fully chainable sessions query returning Promise-like */
function makeFullSessionsChain(data: unknown[]) {
  const terminal = {
    data,
    error: null,
    then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
  };
  const orderChain = { ...terminal };
  const gteChain = { ...terminal, order: jest.fn(() => orderChain) };
  const eq2Chain = { ...terminal, gte: jest.fn(() => gteChain) };
  const eq1Chain = { ...terminal, eq: jest.fn(() => eq2Chain) };
  return { select: jest.fn(() => eq1Chain) };
}

// ─── Test data ───────────────────────────────────────────

const NOW = new Date('2026-07-19T12:00:00Z');

// Member who worked out 2 days ago → healthy
const RECENT_SESSION_DATE = new Date(NOW.getTime() - 2 * 86400000).toISOString();
// Member who worked out 10 days ago → at-risk (no_workouts_7d)
const STALE_SESSION_DATE = new Date(NOW.getTime() - 10 * 86400000).toISOString();

const HEALTHY_MEMBER = { id: 'member-healthy', display_name: 'Healthy User' };
const AT_RISK_MEMBER = { id: 'member-atrisk', display_name: 'At Risk User' };

const MEMBERS = [HEALTHY_MEMBER, AT_RISK_MEMBER];
const SESSIONS = [
  { member_id: 'member-healthy', created_at: RECENT_SESSION_DATE },
  { member_id: 'member-atrisk', created_at: STALE_SESSION_DATE },
];

// ─── Tests ───────────────────────────────────────────────

describe('fetchGymAtRiskMembers', () => {
  it('returns only the at-risk member when one member is healthy and one is at-risk', async () => {
    const admin = makeFullAdminMock(MEMBERS, SESSIONS) as unknown as Parameters<typeof fetchGymAtRiskMembers>[0];
    const result: AtRiskMember[] = await fetchGymAtRiskMembers(admin, 'gym-123');

    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe('member-atrisk');
    expect(result[0].memberName).toBe('At Risk User');
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons[0].type).toBe('no_workouts_7d');
  });

  it('returns [] for an empty gym (no members)', async () => {
    const admin = makeFullAdminMock([], []) as unknown as Parameters<typeof fetchGymAtRiskMembers>[0];
    const result = await fetchGymAtRiskMembers(admin, 'gym-empty');
    expect(result).toEqual([]);
  });
});

// ─── Full mock admin that properly resolves Promise.all ──

function makeFullAdminMock(membersData: unknown[], sessionsData: unknown[]) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'members') return makeFullMembersChain(membersData);
      if (table === 'workout_sessions') return makeFullSessionsChain(sessionsData);
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}
