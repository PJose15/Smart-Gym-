/**
 * Push notification service â€” handles registration, permissions,
 * local notifications, and push token management.
 * Follows the fire-and-forget pattern for non-blocking operations.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { supabase } from './supabase';
import { isFeatureEnabled } from './featureFlags';
import { trackEvent } from './events';
import type { NotificationType } from '@nexera/types';

// â”€â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// â”€â”€â”€ Token Registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Requests permission and registers the Expo push token with Supabase.
 * Safe to call multiple times â€” upserts the token.
 * Returns the token string or null if registration failed.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!isFeatureEnabled('push_notifications')) return null;
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      trackEvent('push_permission_denied');
      return null;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Nexera',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E0142F',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData.data;

    // Save token to Supabase (upsert â€” idempotent)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error: upsertErr } = await supabase.from('device_tokens').upsert(
        {
          profile_id: user.id,
          expo_push_token: token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,expo_push_token' },
      );
      if (upsertErr && __DEV__) console.warn('[pushToken] upsert failed:', upsertErr.message);
      trackEvent('push_token_registered');
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Deactivates the push token for this device (called on sign-out).
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('device_tokens')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('profile_id', user.id)
        .eq('expo_push_token', tokenData.data);
    }
  } catch {
    // Silent
  }
}

// ─── Deep Link Handler ───────────────────────────────────────────────────────

/**
 * Maps every NotificationType to a route resolver function.
 * Typed as Record<NotificationType, ...> so tsc enforces totality:
 * adding a new union member without updating this map is a compile error.
 *
 * Deep-link safety note: challenges/[id] and coach-notes/[id] both render
 * graceful “not found” states for stale IDs (verified Phase 3) — no extra
 * guard needed here.
 */
const NOTIFICATION_ROUTES: Record<
  NotificationType,
  (data: Record<string, string>) => string
> = {
  // ── Activity ──────────────────────────────────────────────────────────────
  pr_achieved: () => '/(tabs)/progress',
  badge_unlocked: () => '/(tabs)/profile',
  level_up: () => '/(tabs)/profile',
  streak_milestone: () => '/(tabs)/profile',
  // streak_broken: nudge member back to the home tab (motivation context)
  streak_broken: () => '/(tabs)/',
  leaderboard_rank: () => '/leaderboard',
  challenge_rank_change: (data) => {
    const id = data.challenge_id?.trim();
    return id ? `/challenges/${id}` : '/(tabs)/feed';
  },
  challenge_complete: (data) => {
    const id = data.challenge_id?.trim();
    return id ? `/challenges/${id}` : '/(tabs)/feed';
  },

  // ── Social ────────────────────────────────────────────────────────────────
  feed_reaction: () => '/(tabs)/feed',
  feed_comment: () => '/(tabs)/feed',
  new_follower: () => '/(tabs)/feed',

  // ── Coaching ──────────────────────────────────────────────────────────────
  coach_note: (data) => {
    const noteId = data.note_id?.trim();
    return noteId ? `/coach-notes/${noteId}` : '/(tabs)/profile';
  },
  checkin_generated: () => '/coach-notes',
  checkin_reply: () => '/coach-notes',
  program_assigned: () => '/program',

  // ── Operational (owner/trainer-facing; safe home-tab fallback on member app)
  trial_ending: () => '/(tabs)/profile',
  payment_failed: () => '/(tabs)/profile',
  subscription_cancelled: () => '/(tabs)/profile',
  member_at_risk: () => '/(tabs)/profile',
  weekly_summary: () => '/(tabs)/profile',
  checkin_overdue: () => '/(tabs)/profile',
  machine_underutilized: () => '/(tabs)/profile',

  // ── Agent-initiated (member-facing) ────────────────────────────────────
  // agent_dormant_alert / agent_welcome: nudge back to home for re-engagement
  agent_dormant_alert: () => '/(tabs)/',
  agent_welcome: () => '/(tabs)/',
};

/**
 * Resolves a notification type + data payload to a mobile route string.
 * Returns null when the type is unrecognised (defensive — union is exhaustive).
 *
 * Exported so the Phase 6 inbox screen (plan 06-09) can reuse this for
 * tap-navigation without duplicating the route map.
 */
export function resolveNotificationRoute(
  type: NotificationType,
  data: Record<string, string>,
): string | null {
  const resolver = NOTIFICATION_ROUTES[type];
  return resolver ? resolver(data) : null;
}

/**
 * Handles a notification response (tap) by navigating to the relevant screen.
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data as
    | Record<string, string>
    | undefined;
  const type = data?.type as NotificationType | undefined;

  if (type) {
    const path = resolveNotificationRoute(type, data ?? {});
    if (path) {
      trackEvent('push_notification_tapped', { type });
      router.push(path as Href);
    }
  }
}

// â”€â”€â”€ Local Notification Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Schedules a local notification immediately.
 * Used for badge unlocks and streak milestones (client-side triggers).
 */
export async function sendLocalNotification(payload: {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  if (!isFeatureEnabled('push_notifications')) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: { type: payload.type, ...payload.data },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Silent â€” local notifications are best-effort
  }
}

// â”€â”€â”€ Listener Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Sets up notification listeners. Call once from root layout.
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationListeners(): () => void {
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

  const foregroundSubscription =
    Notifications.addNotificationReceivedListener(() => {
      // Foreground notifications are shown via the handler above
    });

  return () => {
    responseSubscription.remove();
    foregroundSubscription.remove();
  };
}
