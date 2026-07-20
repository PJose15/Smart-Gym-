/**
 * @jest-environment node
 *
 * Tests: sendCheckInToMember dispatcher integration (06-06 Task 1)
 *
 * Asserts:
 *  - sendNotification called with type 'checkin_generated' and correct args
 *  - No direct notifications.insert remains (dispatcher owns the inbox row)
 *  - Dispatcher rejection never throws to caller (fire-and-forget safe)
 */

// ── Mocks declared before imports ─────────────────────────────────────────────

const mockSendNotification = jest.fn().mockResolvedValue('sent');
jest.mock('@/lib/notifications/dispatcher', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

// ── Supabase admin mock ────────────────────────────────────────────────────────

const mockNotificationsInsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockWeeklyCheckinsUpdate = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();

const mockAdmin = {
  from: jest.fn((table: string) => {
    if (table === 'notifications') {
      return {
        insert: mockNotificationsInsert,
      };
    }
    if (table === 'weekly_checkins') {
      return {
        update: mockWeeklyCheckinsUpdate,
        eq: mockEq,
      };
    }
    return { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
  }),
};

// Make weekly_checkins.update().eq().eq() chain resolve
mockWeeklyCheckinsUpdate.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq });

// ── Import subject (after mocks) ──────────────────────────────────────────────

import { sendCheckInToMember } from '../sendCheckIn';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHECK_IN_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const MEMBER_ID = 'b2b2b2b2-0000-0000-0000-000000000002';
const GYM_ID = 'c3c3c3c3-0000-0000-0000-000000000003';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendCheckInToMember — dispatcher integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendNotification.mockResolvedValue('sent');
  });

  it('T1: calls sendNotification with type checkin_generated and correct args', async () => {
    await sendCheckInToMember(
      CHECK_IN_ID,
      MEMBER_ID,
      GYM_ID,
      mockAdmin as unknown as SupabaseClient
    );

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'checkin_generated',
        member_id: MEMBER_ID,
        gym_id: GYM_ID,
        data: expect.objectContaining({ check_in_id: CHECK_IN_ID }),
      })
    );
  });

  it('T2: no direct notifications.insert call (dispatcher owns inbox row)', async () => {
    await sendCheckInToMember(
      CHECK_IN_ID,
      MEMBER_ID,
      GYM_ID,
      mockAdmin as unknown as SupabaseClient
    );

    expect(mockNotificationsInsert).not.toHaveBeenCalled();
  });

  it('T3: dispatcher rejection does not throw (fire-and-forget safe)', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('dispatch failed'));

    // Must not throw
    await expect(
      sendCheckInToMember(CHECK_IN_ID, MEMBER_ID, GYM_ID, mockAdmin as unknown as SupabaseClient)
    ).resolves.toBeUndefined();
  });

  it('T4: still updates weekly_checkins sent_at before dispatching', async () => {
    await sendCheckInToMember(
      CHECK_IN_ID,
      MEMBER_ID,
      GYM_ID,
      mockAdmin as unknown as SupabaseClient
    );

    expect(mockAdmin.from).toHaveBeenCalledWith('weekly_checkins');
  });
});
