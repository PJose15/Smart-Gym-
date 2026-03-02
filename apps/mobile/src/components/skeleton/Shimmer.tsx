import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, DimensionValue, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

const USE_NATIVE = Platform.OS !== 'web';
const SHIMMER_DURATION = 1200;

// ─── Shared Animation Context ─────────────────────────────

const ShimmerContext = createContext<Animated.Value | null>(null);

export function ShimmerProvider({ children }: { children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: USE_NATIVE,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <ShimmerContext.Provider value={translateX}>
      {children}
    </ShimmerContext.Provider>
  );
}

// ─── Shimmer Component ────────────────────────────────────

interface ShimmerProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Shimmer({ width, height, borderRadius = 4, style }: ShimmerProps) {
  const sharedTranslateX = useContext(ShimmerContext);
  const localTranslateX = useRef(new Animated.Value(-1)).current;

  const translateX = sharedTranslateX ?? localTranslateX;

  // Fallback: run own loop if no provider
  useEffect(() => {
    if (sharedTranslateX) return;
    const animation = Animated.loop(
      Animated.timing(localTranslateX, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: USE_NATIVE,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [sharedTranslateX, localTranslateX]);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              {
                translateX: translateX.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-300, 300],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    width: 300,
  },
});
