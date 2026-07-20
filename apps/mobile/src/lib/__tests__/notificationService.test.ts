/**
 * Tests for notificationService — route map totality and deep-link behavior.
 *
 * Mocks: expo-notifications, expo-device, expo-constants, expo-router,
 * ../supabase, ../featureFlags, ../events (per mobile test conventions).
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExpoToken[test]' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { HIGH: 5 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
}));

jest.mock('../featureFlags', () => ({
  isFeatureEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock('../events', () => ({
  trackEvent: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { resolveNotificationRoute } from '../notificationService';
import type { NotificationType } from '@nexera/types';

// ─── Canonical 24 types ───────────────────────────────────────────────────────

const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  // Activity
  'pr_achieved', 'badge_unlocked', 'level_up', 'streak_milestone',
  'streak_broken', 'leaderboard_rank', 'challenge_rank_change', 'challenge_complete',
  // Social
  'feed_reaction', 'feed_comment', 'new_follower',
  // Coaching
  'coach_note', 'checkin_generated', 'checkin_reply', 'program_assigned',
  // Operational (owner/trainer-facing)
  'trial_ending', 'payment_failed', 'subscription_cancelled',
  'member_at_risk', 'weekly_summary', 'checkin_overdue', 'machine_underutilized',
  // Agent-initiated
  'agent_dormant_alert', 'agent_welcome',
];

// ─── Test 1: Route map totality ───────────────────────────────────────────────

describe('resolveNotificationRoute — totality', () => {
  it('returns a string starting with "/" for all 24 NotificationType values', () => {
    for (const type of ALL_NOTIFICATION_TYPES) {
      const result = resolveNotificationRoute(type, {});
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\//);
    }
  });

  it('covers exactly 24 types', () => {
    expect(ALL_NOTIFICATION_TYPES).toHaveLength(24);
  });
});

// ─── Test 2: coach_note deep link ────────────────────────────────────────────

describe('resolveNotificationRoute — coach_note', () => {
  it('routes to /coach-notes/:id when note_id is present', () => {
    expect(resolveNotificationRoute('coach_note', { note_id: 'abc' })).toBe('/coach-notes/abc');
  });

  it('falls back to /(tabs)/profile when note_id is absent', () => {
    expect(resolveNotificationRoute('coach_note', {})).toBe('/(tabs)/profile');
  });
});

// ─── Test 3: challenge deep links ─────────────────────────────────────────────

describe('resolveNotificationRoute — challenge types', () => {
  it('challenge_rank_change routes to /challenges/:id when challenge_id present', () => {
    expect(resolveNotificationRoute('challenge_rank_change', { challenge_id: 'xyz' })).toBe('/challenges/xyz');
  });

  it('challenge_rank_change falls back to /(tabs)/feed when challenge_id absent', () => {
    expect(resolveNotificationRoute('challenge_rank_change', {})).toBe('/(tabs)/feed');
  });

  it('challenge_complete routes to /challenges/:id when challenge_id present', () => {
    expect(resolveNotificationRoute('challenge_complete', { challenge_id: 'xyz' })).toBe('/challenges/xyz');
  });

  it('challenge_complete falls back to /(tabs)/feed when challenge_id absent', () => {
    expect(resolveNotificationRoute('challenge_complete', {})).toBe('/(tabs)/feed');
  });
});

// ─── Test 4: static routes (existing behavior preserved) ─────────────────────

describe('resolveNotificationRoute — static routes', () => {
  it('program_assigned routes to /program', () => {
    expect(resolveNotificationRoute('program_assigned', {})).toBe('/program');
  });

  it('leaderboard_rank routes to /leaderboard', () => {
    expect(resolveNotificationRoute('leaderboard_rank', {})).toBe('/leaderboard');
  });

  it('pr_achieved routes to /(tabs)/progress', () => {
    expect(resolveNotificationRoute('pr_achieved', {})).toBe('/(tabs)/progress');
  });

  it('streak_broken routes to /(tabs)/', () => {
    const result = resolveNotificationRoute('streak_broken', {});
    expect(result).toMatch(/^\/(tabs)\//);
  });

  it('badge_unlocked routes to /(tabs)/profile', () => {
    expect(resolveNotificationRoute('badge_unlocked', {})).toBe('/(tabs)/profile');
  });

  it('streak_milestone routes to /(tabs)/profile', () => {
    expect(resolveNotificationRoute('streak_milestone', {})).toBe('/(tabs)/profile');
  });
});
