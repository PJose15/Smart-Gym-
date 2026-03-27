/**
 * Push notification service — handles registration, permissions,
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

// ─── Configuration ───────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Token Registration ──────────────────────────────────

/**
 * Requests permission and registers the Expo push token with Supabase.
 * Safe to call multiple times — upserts the token.
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
        lightColor: '#4361ee',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData.data;

    // Save token to Supabase (upsert — idempotent)
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
      if (upsertErr) console.warn('[pushToken] upsert failed:', upsertErr.message);
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

// ─── Deep Link Handler ───────────────────────────────────

const NOTIFICATION_ROUTES: Record<
  NotificationType,
  (data: Record<string, string>) => string
> = {
  coach_note: (data) => {
    const noteId = data.note_id?.trim();
    return noteId ? `/coach-notes/${noteId}` : '/(tabs)/profile';
  },
  badge_unlocked: () => '/(tabs)/profile',
  streak_milestone: () => '/(tabs)/profile',
  leaderboard_rank: () => '/leaderboard',
};

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

  if (type && NOTIFICATION_ROUTES[type]) {
    const path = NOTIFICATION_ROUTES[type](data ?? {});
    trackEvent('push_notification_tapped', { type });
    router.push(path as Href);
  }
}

// ─── Local Notification Helpers ──────────────────────────

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
    // Silent — local notifications are best-effort
  }
}

// ─── Listener Setup ──────────────────────────────────────

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
