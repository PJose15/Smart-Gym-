import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
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
      </Stack>
    </ErrorBoundary>
  );
}
