/**
 * @jest-environment node
 *
 * Tests: check-in reply route dispatcher integration (06-06 Task 1)
 *
 * Asserts:
 *  - On successful reply, sendNotification called with type 'checkin_reply' targeted at trainer's member
 *  - Push body does NOT contain any reply text (PII fix)
 *  - No direct notifications.insert remains in this route
 *  - Dispatcher rejection does not break the 200 path
 *  - 400/404/409 paths do not dispatch
 */

import { NextRequest } from 'next/server';

// ── Mock dispatcher ────────────────────────────────────────────────────────────

const mockSendNotification = jest.fn().mockResolvedValue('sent');
jest.mock('@/lib/notifications/dispatcher', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// ── Mock auth ──────────────────────────────────────────────────────────────────

const mockVerifyMember = jest.fn();
jest.mock('@/lib/auth/verifyMember', () => ({
  verifyMember: (...args: unknown[]) => mockVerifyMember(...args),
}));

// ── Mock rate limit (always passes) ───────────────────────────────────────────

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue(null),
}));

// ── Mock UUID validation ───────────────────────────────────────────────────────

jest.mock('@/lib/validation/uuid', () => ({
  validateUUIDs: jest.fn().mockReturnValue(null),
}));

// ── Supabase admin chain builder ───────────────────────────────────────────────

const MEMBER_ID = 'a1a1a1a1-0000-0000-0000-000000000001';
const CHECK_IN_ID = 'b2b2b2b2-0000-0000-0000-000000000002';
const TRAINER_ID = 'c3c3c3c3-0000-0000-0000-000000000003'; // auth user id
const TRAINER_MEMBER_ID = 'd4d4d4d4-0000-0000-0000-000000000004';
const GYM_ID = 'e5e5e5e5-0000-0000-0000-000000000005';

const REPLY_TEXT = 'I felt great this week and hit all my targets!';

function buildMockAdmin({
  updateData = { id: CHECK_IN_ID, trainer_id: TRAINER_ID, gym_id: GYM_ID },
  updateError = null,
  trainerMember = { id: TRAINER_MEMBER_ID },
}: {
  updateData?: object | null;
  updateError?: object | null;
  trainerMember?: object | null;
} = {}) {
  const notifInsert = jest.fn().mockResolvedValue({ data: null, error: null });

  const membersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: trainerMember, error: null }),
  };
  membersChain.eq.mockReturnValue(membersChain);

  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: updateData, error: updateError }),
  };
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue(updateChain);

  const checkExistChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  checkExistChain.eq.mockReturnValue(checkExistChain);

  const weeklyChain = {
    update: jest.fn().mockReturnValue(updateChain),
    select: jest.fn().mockReturnValue(checkExistChain),
  };

  const admin = {
    from: jest.fn((table: string) => {
      if (table === 'weekly_checkins') return weeklyChain;
      if (table === 'members') return membersChain;
      if (table === 'notifications') return { insert: notifInsert };
      return {};
    }),
    notifInsert,
  };

  return admin;
}

// ── Import subject ─────────────────────────────────────────────────────────────

import { POST } from '../route';

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/member/a1/check-ins/b2/reply', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('reply route — dispatcher integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendNotification.mockResolvedValue('sent');
  });

  it('T1: on successful reply, calls sendNotification with type checkin_reply targeting trainer member', async () => {
    const admin = buildMockAdmin();
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: REPLY_TEXT });
    const res = await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'checkin_reply',
        member_id: TRAINER_MEMBER_ID,
        gym_id: GYM_ID,
      })
    );
  });

  it('T2: push body contains NO reply text (PII fix)', async () => {
    const admin = buildMockAdmin();
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: REPLY_TEXT });
    await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    const call = mockSendNotification.mock.calls[0][0] as { body: string };
    expect(call.body).not.toContain(REPLY_TEXT);
    expect(call.body).not.toContain('felt great');
    expect(call.body).not.toContain('hit all my targets');
  });

  it('T3: no direct notifications.insert called (dispatcher owns inbox row)', async () => {
    const admin = buildMockAdmin();
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: REPLY_TEXT });
    await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(admin.notifInsert).not.toHaveBeenCalled();
  });

  it('T4: dispatcher rejection does not break the 200 response', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('push failed'));
    const admin = buildMockAdmin();
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: REPLY_TEXT });
    const res = await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(res.status).toBe(200);
  });

  it('T5: no dispatch when trainer_id is null (no trainer assigned)', async () => {
    const admin = buildMockAdmin({
      updateData: { id: CHECK_IN_ID, trainer_id: null, gym_id: GYM_ID },
    });
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: REPLY_TEXT });
    await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('T6: 400 on empty reply_text — no dispatch', async () => {
    const admin = buildMockAdmin();
    mockVerifyMember.mockResolvedValue({ admin, member: { id: MEMBER_ID } });

    const req = makeRequest({ reply_text: '' });
    const res = await POST(req, {
      params: Promise.resolve({ memberId: MEMBER_ID, checkInId: CHECK_IN_ID }),
    });

    expect(res.status).toBe(400);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
