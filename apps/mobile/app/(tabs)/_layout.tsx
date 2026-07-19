import { useEffect, useRef } from 'react';
import { Animated, Platform, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { useUnreadFeedCount } from '../../src/hooks/useUnreadFeedCount';

const USE_NATIVE = Platform.OS !== 'web';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function AnimatedTabIcon({
  name,
  activeName,
  color,
  size,
  focused,
}: {
  name: IoniconsName;
  activeName: IoniconsName;
  color: string;
  size: number;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.3 : 1)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(focused ? -4 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.3 : 1,
        tension: 150,
        friction: 6,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(translateY, {
        toValue: focused ? -4 : 0,
        tension: 150,
        friction: 6,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(bgOpacity, {
        toValue: focused ? 1 : 0,
        duration: 250,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={tabIconStyles.wrapper}>
      <Animated.View
        style={[
          tabIconStyles.glowPill,
          {
            opacity: bgOpacity,
            backgroundColor: colors.primary + '20',
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        <Ionicons name={focused ? activeName : name} size={size} color={color} />
      </Animated.View>
      <Animated.View
        style={[
          tabIconStyles.dot,
          {
            opacity: bgOpacity,
            backgroundColor: color,
            transform: [{ scale: focused ? 1 : 0 }],
          },
        ]}
      />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 40,
  },
  glowPill: {
    position: 'absolute',
    width: 48,
    height: 36,
    borderRadius: 18,
    top: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
});

export default function TabLayout() {
  const { count: unreadFeedCount } = useUnreadFeedCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.white,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: typography.fontSerif,
          fontSize: 17,
          letterSpacing: 2,
          color: colors.text,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: typography.fontSemiBold,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          // L1 elevated surface with a hairline top border — depth via tonal
          // layers, no drop shadows (design.md §3.11).
          backgroundColor: Platform.OS === 'ios' ? 'rgba(18, 18, 20, 0.85)' : colors.surface,
          height: 65,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
          ...(Platform.OS === 'ios' ? { position: 'absolute' as const } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="home-outline" activeName="home" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarAccessibilityLabel: 'Scan QR code tab',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="qr-code-outline" activeName="qr-code" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Gym feed tab',
          tabBarBadge:
            unreadFeedCount > 0
              ? unreadFeedCount > 99
                ? '99+'
                : unreadFeedCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.white,
            fontSize: 10,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="people-outline" activeName="people" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarAccessibilityLabel: 'Workout progress tab',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="bar-chart-outline" activeName="bar-chart" size={size} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="person-outline" activeName="person" size={size} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
