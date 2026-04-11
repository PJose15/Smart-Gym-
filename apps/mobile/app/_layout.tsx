import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { colors } from '../src/theme/colors';
import { supabase } from '../src/lib/supabase';
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
import { useOfflineSync } from '../src/lib/hooks/useOfflineSync';

export default function RootLayout() {
  useOfflineSync();
  const lastResponseHandled = useRef(false);
  const segments = useSegments();

  // Auth state: undefined = loading, null = no session, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

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
  }, [session]);

  // Loading state
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine if we're on the auth screen
  const inAuthGroup = segments[0] === 'auth';

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <OfflineBanner />
      {/* Redirect unauthenticated users to auth */}
      {!session && !inAuthGroup && <Redirect href="/auth" />}
      {/* Redirect authenticated users away from auth */}
      {session && inAuthGroup && <Redirect href="/(tabs)" />}
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
