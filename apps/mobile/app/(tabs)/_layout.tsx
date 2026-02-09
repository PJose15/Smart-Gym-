import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4361ee',
        tabBarInactiveTintColor: '#6c757d',
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#ffffff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'\u{1F3E0}'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'\u{1F4F7}'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'\u{1F4CA}'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'\u{1F464}'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
