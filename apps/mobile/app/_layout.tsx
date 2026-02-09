import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </>
  );
}
