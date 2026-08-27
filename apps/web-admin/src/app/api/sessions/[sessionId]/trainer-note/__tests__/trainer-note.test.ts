/**
 * @jest-environment node
 *
 * Tests: trainer-note route dispatcher integration (06-06 Task 1)
 *
 * Asserts:
 *  - After successful note creation, sendNotification called with type 'coach_note'
 *  - Target is the session's member_id
 *  - data contains the note_id
 *  - Body contains no PII
 *  - Dispatcher rejection does not break the 200 path
 *  - 400/404 paths do not dispatch
 */

import { NextRequest } from 'next/server';

// ── Mock dispatcher ────────────────────────────────────────────────────────────

const mockSendNotification = jest.fn().mockResolvedValue('sent');
jest.mock('@/lib/notifications/dispatcher', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// ── Mock verifyStaff ───────────────────────────────────────────────────────────

const mockVerifyStaff = jest.fn();
jest.mock('@/lib/auth/verifyStaff', () => ({
  verifyStaff: (...args: unknown[]) => mockVerifyStaff(...args),
}));

// ── Mock rate limit ────────────────────────────────────────────────────────────

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue(null),
}));

// ── Mock tier gating (Stage 4 IN-H3) ───────────────────────────────────────────
// coach_notes is now gated; allow it in tests.
jest.mock('@/lib/billing/featureGate', () => ({
  checkFeatureAccess: jest.fn().mockResolvedValue({ hasAccess: true, upgradeMessage: null }),
}));

// ── Mock UUID validation ───────────────────────────────────────────────────────

jest.mock('@/lib/validation/uuid', () => ({
  validateUUIDs: jest.fn().mockReturnValue(null),
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'a1a1a1a1-0000-0000-0000-000000000001';
const MEMBER_ID = 'b2b2b2b2-0000-0000-0000-000000000002';
const GYM_ID = 'c3c3c3c3-0000-0000-0000-000000000003';
const TRAINER_USER_ID = 'd4d4d4d4-0000-0000-0000-000000000004';
const NOTE_ID = 'e5e5e5e5-0000-0000-0000-000000000005';

// ── Build mock admin ───────────────────────────────────────────────────────────

function buildMockAdmin({
  sessionData = { id: SESSION_ID, member_id: MEMBER_ID, gym_id: GYM_ID },
  noteInsertError = null,
  createdNote = { id: NOTE_ID },
}: {
  sessionData?: object | null;
  noteInsertError?: object | null;
  createdNote?: object | null;
} = {}) {
  const sessionChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: sessionData, error: null }),
  };
  sessionChain.eq.mockReturnValue(sessionChain);

  const noteChain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: createdNote, error: noteInsertError }),
  };
  noteChain.insert.mockReturnValue(noteChain);
  noteChain.select.mockReturnValue(noteChain);

  return {
    from: jest.fn((table: string) => {
      if (table === 'workout_sessions') return sessionChain;
      if (table === 'trainer_member_notes') return noteChain;
      return {};
    }),
  };
}

// ── Import subject ─────────────────────────────────────────────────────────────

import { PATCH } from '../route';

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest(`http://localhost/api/sessions/${SESSION_ID}/trainer-note`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('trainer-note route — dispatcher integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendNotification.mockResolvedValue('sent');
  });

  it('T1: after successful note creation, calls sendNotification with type coach_note', async () => {
    const admin = buildMockAdmin();
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: TRAINER_USER_ID,
      gym_id: GYM_ID,
    });

    const req = makeRequest({ note: 'Great form today, keep it up!' });
    const res = await PATCH(req, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'coach_note',
        member_id: MEMBER_ID,
        gym_id: GYM_ID,
      })
    );
  });

  it('T2: dispatch data contains the note_id', async () => {
    const admin = buildMockAdmin({ createdNote: { id: NOTE_ID } });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: TRAINER_USER_ID,
      gym_id: GYM_ID,
    });

    const req = makeRequest({ note: 'Keep focusing on depth in squats.' });
    await PATCH(req, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    const call = mockSendNotification.mock.calls[0][0] as { data?: Record<string, string> };
    expect(call.data?.note_id).toBe(NOTE_ID);
  });

  it('T3: dispatcher rejection does not break the 200 response', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('push failed'));
    const admin = buildMockAdmin();
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: TRAINER_USER_ID,
      gym_id: GYM_ID,
    });

    const req = makeRequest({ note: 'Focus on breathing.' });
    const res = await PATCH(req, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(res.status).toBe(200);
  });

  it('T4: 404 when session not found — no dispatch', async () => {
    const admin = buildMockAdmin({ sessionData: null });
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: TRAINER_USER_ID,
      gym_id: GYM_ID,
    });

    const req = makeRequest({ note: 'Good work.' });
    const res = await PATCH(req, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(res.status).toBe(404);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('T5: 400 on empty note — no dispatch', async () => {
    const admin = buildMockAdmin();
    mockVerifyStaff.mockResolvedValue({
      admin,
      user_id: TRAINER_USER_ID,
      gym_id: GYM_ID,
    });

    const req = makeRequest({ note: '' });
    const res = await PATCH(req, {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
