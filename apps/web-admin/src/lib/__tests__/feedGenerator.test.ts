/**
 * @jest-environment node
 *
 * Tests for lib/feedGenerator.ts — session milestone events.
 *
 * Ownership contract (Stage 6): PR feed events (pr_weight / pr_volume) are
 * owned by /api/sessions/pr-check. generateSessionFeedEvents must NOT create
 * PR events even when is_personal_best is true — its old PR block was always
 * dedupe-shadowed by pr-check's earlier insert.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateSessionFeedEvents } from '../feedGenerator';

function makeAdmin() {
  const insert = jest.fn(async () => ({ error: null }));
  const admin: any = {
    from: jest.fn(() => ({ insert })),
  };
  return { admin, insert };
}

const BASE_INPUT = {
  member_id: 'bbbbbbbb-0000-0000-0000-000000000002',
  gym_id: 'dddddddd-0000-0000-0000-000000000004',
  display_name: 'Alice',
  is_personal_best: false,
  best_weight_lbs: null as number | null,
  streak: 0,
  total_sessions: 3,
  leveled_up: false,
  new_level: null as number | null,
};

describe('generateSessionFeedEvents', () => {
  test('does NOT create a pr_weight event even when is_personal_best is true', async () => {
    const { admin, insert } = makeAdmin();
    await generateSessionFeedEvents(admin, {
      ...BASE_INPUT,
      is_personal_best: true,
      best_weight_lbs: 225,
    });

    // No dedupe lookup, no insert — PR events belong to pr-check
    expect(admin.from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  test('still creates streak / session / level-up milestone events', async () => {
    const { admin, insert } = makeAdmin();
    await generateSessionFeedEvents(admin, {
      ...BASE_INPUT,
      is_personal_best: true, // must not add a 4th event
      best_weight_lbs: 225,
      streak: 7,
      total_sessions: 50,
      leveled_up: true,
      new_level: 4,
    });

    expect(insert).toHaveBeenCalledTimes(3);
    const types = insert.mock.calls.map((c: any[]) => (c[0] as any).event_type);
    expect(types).toEqual(['streak_milestone', 'session_milestone', 'level_up']);
    expect(types).not.toContain('pr_weight');
  });

  test('inserts nothing when no milestone is hit', async () => {
    const { admin, insert } = makeAdmin();
    await generateSessionFeedEvents(admin, BASE_INPUT);
    expect(insert).not.toHaveBeenCalled();
  });
});
