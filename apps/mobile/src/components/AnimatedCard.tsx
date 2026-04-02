import { useEffect, useRef } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

const USE_NATIVE = Platform.OS !== 'web';

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  style?: ViewStyle;
}

export function AnimatedCard({ children, index = 0, delay, style }: AnimatedCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const staggerDelay = delay ?? index * 150;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        delay: staggerDelay,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: staggerDelay,
        tension: 50,
        friction: 8,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay: staggerDelay,
        tension: 50,
        friction: 6,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 4,
          opacity,
          transform: [{ translateY }, { scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
