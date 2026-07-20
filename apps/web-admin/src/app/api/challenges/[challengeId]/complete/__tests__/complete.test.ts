/**
 * @jest-environment node
 *
 * Tests: challenge-complete growth-agent trigger (AGENT-03, automation #12)
 * Covers: challenge-ended fires once per challenge with dedup_key,
 *         404 path fires nothing, no-winner case, response contract.
 */

// ── Mocks declared before imports ─────────────────────────────────────────────
jest.mock('@/lib/billing/triggerAgent');
jest.mock('@/lib/auth/verifyStaff');
jest.mock('@/lib/validation/uuid');
jest.mock('@/lib/rateLimit');

// ── Imports ───────────────────────────────────────────────────────────────────
import { NextRequest } from 'next/server';
import { POST } from '../route';

import { triggerUptimizeAIAgent } from '@/lib/billing/triggerAgent';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';
import { checkRateLimit } from '@/lib/rateLimit';

// ── Typed mock refs ───────────────────────────────────────────────────────────
const mockTrigger = triggerUptimizeAIAgent as jest.MockedFunction<typeof triggerUptimizeAIAgent>;
const mockVerifyStaff = verifyStaff as jest.MockedFunction<typeof verifyStaff>;
const mockValidateUUIDs = validateUUIDs as jest.MockedFunction<typeof validateUUIDs>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

// ── Test constants ─────────────────────────────────────────────────────────────
const CHALLENGE_ID = 'd4e5f6a7-b8c9-0123-defa-123456789003';
const GYM_ID = 'e5f6a7b8-c9d0-1234-efab-234567890104';
const WINNER_MEMBER_ID = 'f6a7b8c9-d0e1-2345-fabc-345678901205';
const USER_ID = 'a7b8c9d0-e1f2-3456-abcd-456789012306';

// ── Admin mock builder ────────────────────────────────────────────────────────

type ChallengeData = {
  id: string;
  gym_id: string;
  is_active: boolean;
} | null;

type WinnerData = {
  member_id: string;
  current_score: number;
} | null;

function buildAdmin(opts: { challenge: ChallengeData; winner: WinnerData }) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'gym_challenges') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: opts.challenge, error: null }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'challenge_participants') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: opts.winner, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      };
    }),
  };
}

function makeRequest() {
  return new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/challenges/[challengeId]/complete — agent triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockValidateUUIDs.mockReturnValue(null);
    mockRateLimit.mockReturnValue(null);
    mockTrigger.mockResolvedValue({ success: true });

    // Default: active challenge with a winner
    const admin = buildAdmin({
      challenge: { id: CHALLENGE_ID, gym_id: GYM_ID, is_active: true },
      winner: { member_id: WINNER_MEMBER_ID, current_score: 1500 },
    });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: USER_ID,
      gym_id: GYM_ID,
    } as unknown as Awaited<ReturnType<typeof verifyStaff>>);
  });

  const makeParams = (challengeId = CHALLENGE_ID) => ({ params: { challengeId } });

  // ──────────────────────────────────────────────────────────────────────────
  // Happy path: active challenge + winner
  // ──────────────────────────────────────────────────────────────────────────

  it('fires growth-agent challenge-ended with correct payload for active challenge', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const calls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>);
    const challengeCalls = calls.filter(c => c[1]?.event === 'challenge-ended');
    expect(challengeCalls).toHaveLength(1);

    const [agentName, payload] = challengeCalls[0];
    expect(agentName).toBe('growth-agent');
    expect(payload.event).toBe('challenge-ended');
    expect(payload.gym_id).toBe(GYM_ID);
    expect(payload.challenge_id).toBe(CHALLENGE_ID);
    expect(payload.dedup_key).toBe(CHALLENGE_ID);
    expect(payload.winner_member_id).toBe(WINNER_MEMBER_ID);
    expect(payload.is_agent_initiated).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 404 path: challenge not found or already inactive
  // ──────────────────────────────────────────────────────────────────────────

  it('does NOT fire agent when challenge is not found', async () => {
    const admin = buildAdmin({ challenge: null, winner: null });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: USER_ID,
      gym_id: GYM_ID,
    } as unknown as Awaited<ReturnType<typeof verifyStaff>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('does NOT fire agent when challenge is already inactive', async () => {
    const admin = buildAdmin({
      challenge: { id: CHALLENGE_ID, gym_id: GYM_ID, is_active: false },
      winner: null,
    });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: USER_ID,
      gym_id: GYM_ID,
    } as unknown as Awaited<ReturnType<typeof verifyStaff>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // No participants: winner is null — still fires with winner_member_id=null
  // ──────────────────────────────────────────────────────────────────────────

  it('fires challenge-ended with winner_member_id=null when no participants', async () => {
    const admin = buildAdmin({
      challenge: { id: CHALLENGE_ID, gym_id: GYM_ID, is_active: true },
      winner: null,
    });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: USER_ID,
      gym_id: GYM_ID,
    } as unknown as Awaited<ReturnType<typeof verifyStaff>>);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const calls = (mockTrigger.mock.calls as Array<[string, Record<string, unknown>]>);
    const challengeCalls = calls.filter(c => c[1]?.event === 'challenge-ended');
    expect(challengeCalls).toHaveLength(1);
    expect(challengeCalls[0][1].winner_member_id).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Response contract unchanged: { success: true, winner_id }
  // ──────────────────────────────────────────────────────────────────────────

  it('returns { success: true, winner_id } contract unchanged', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true, winner_id: WINNER_MEMBER_ID });
  });

  it('returns winner_id=null when no participants', async () => {
    const admin = buildAdmin({
      challenge: { id: CHALLENGE_ID, gym_id: GYM_ID, is_active: true },
      winner: null,
    });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: USER_ID,
      gym_id: GYM_ID,
    } as unknown as Awaited<ReturnType<typeof verifyStaff>>);

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body).toEqual({ success: true, winner_id: null });
  });
});
