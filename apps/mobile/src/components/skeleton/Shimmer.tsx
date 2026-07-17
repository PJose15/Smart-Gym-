import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const USE_NATIVE = Platform.OS !== 'web';
// DOC_03 Section 14: left→right, 1.5s, linear, infinite
const SHIMMER_DURATION = 1500;
// DOC_03 Section 14: base #1F1F26, shine #252530
const SHINE_GRADIENT = [
  'rgba(37, 37, 48, 0)',
  colors.bgSkeletonShine,
  'rgba(37, 37, 48, 0)',
] as const;

// ─── Shared Animation Context ─────────────────────────────
// One shared animation drives every skeleton instance (DOC_03 Section 20).

const ShimmerContext = createContext<Animated.Value | null>(null);

export function ShimmerProvider({ children }: { children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(-1)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      translateX.setValue(-1); // static base — no shimmer
      return;
    }
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [translateX, reducedMotion]);

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
  const reducedMotion = useReducedMotion();

  const translateX = sharedTranslateX ?? localTranslateX;

  // Fallback: run own loop if no provider
  useEffect(() => {
    if (sharedTranslateX || reducedMotion) return;
    const animation = Animated.loop(
      Animated.timing(localTranslateX, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [sharedTranslateX, localTranslateX, reducedMotion]);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.bgSkeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Reduced motion — static base block, no shimmer (DOC_03 Section 15) */}
      {!reducedMotion && (
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
            colors={SHINE_GRADIENT}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradient}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Spec-named alias (DOC_03 Section 14 calls the base primitive `Skeleton`).
 * Same component — kept as `Shimmer` for existing call sites.
 */
export const Skeleton = Shimmer;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    width: 300,
  },
});
