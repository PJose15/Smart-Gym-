import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { colors } from '../src/theme/colors';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  handleNotificationResponse,
} from '../src/lib/notificationService';
import {
  isFeatureEnabled,
  refreshFeatureFlags,
  needsRefresh,
} from '../src/lib/featureFlags';

export default function RootLayout() {
  const lastResponseHandled = useRef(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      if (needsRefresh()) await refreshFeatureFlags();
      if (!isFeatureEnabled('push_notifications')) return;

      registerForPushNotifications();

      cleanup = setupNotificationListeners();

      // Handle cold-start: app opened from a notification tap
      if (!lastResponseHandled.current) {
        lastResponseHandled.current = true;
        const lastResponse =
          await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handleNotificationResponse(lastResponse);
        }
      }
    })();

    return () => cleanup?.();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.dark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{ title: 'Sign In', headerShown: false }}
        />
        <Stack.Screen
          name="machine/[slug]"
          options={{ title: 'Machine Details' }}
        />
        <Stack.Screen
          name="workout/[id]"
          options={{ title: 'Workout' }}
        />
        <Stack.Screen
          name="workout/complete/[id]"
          options={{ title: 'Workout Complete', headerShown: false }}
        />
        <Stack.Screen
          name="exercise/[name]"
          options={{ title: 'Exercise Details' }}
        />
        <Stack.Screen
          name="coach-notes/index"
          options={{ title: 'Coach Notes' }}
        />
        <Stack.Screen
          name="coach-notes/[id]"
          options={{ title: 'Coach Note' }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
