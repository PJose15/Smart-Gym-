import { useEffect, useRef, useCallback } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const USE_NATIVE = Platform.OS !== 'web';

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AnimatedScreen({ children, style }: AnimatedScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(60)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const animate = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(60);
    scale.setValue(0.92);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }, [opacity, translateY, scale]);

  useFocusEffect(
    useCallback(() => {
      animate();
    }, [animate]),
  );

  useEffect(() => {
    animate();
  }, [animate]);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
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
