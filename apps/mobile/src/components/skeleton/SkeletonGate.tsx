import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { ShimmerProvider } from './Shimmer';

const USE_NATIVE = Platform.OS !== 'web';
const CROSSFADE_DURATION = 400;
const MIN_SKELETON_MS = 1200;

interface SkeletonGateProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

export function SkeletonGate({ loading, skeleton, children }: SkeletonGateProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [ready, setReady] = useState(false);
  const hasLoadedOnce = useRef(false);
  const mountTime = useRef(Date.now());

  // Track when data is ready, but enforce minimum skeleton display
  useEffect(() => {
    if (!loading && !hasLoadedOnce.current) {
      const elapsed = Date.now() - mountTime.current;
      const remaining = Math.max(0, MIN_SKELETON_MS - elapsed);

      const timer = setTimeout(() => setReady(true), remaining);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Run crossfade once both data is loaded AND minimum time has passed
  useEffect(() => {
    if (ready && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      Animated.timing(progress, {
        toValue: 1,
        duration: CROSSFADE_DURATION,
        useNativeDriver: USE_NATIVE,
      }).start(({ finished }) => {
        if (finished) {
          setShowSkeleton(false);
        }
      });
    }
  }, [ready, progress]);

  // After first load, render children directly (no wrapper overhead)
  if (hasLoadedOnce.current && !showSkeleton) {
    return <>{children}</>;
  }

  const dataReady = !loading && ready;

  return (
    <View style={styles.container}>
      {/* Skeleton layer — plain View so flex works on web */}
      {showSkeleton && !dataReady && (
        <View style={styles.layer}>
          <ShimmerProvider>{skeleton}</ShimmerProvider>
        </View>
      )}

      {/* Crossfade: skeleton fading out over content */}
      {showSkeleton && dataReady && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            },
          ]}
          pointerEvents="none"
        >
          <ShimmerProvider>{skeleton}</ShimmerProvider>
        </Animated.View>
      )}

      {/* Real content */}
      {dataReady && (
        <Animated.View style={[styles.layer, { opacity: progress }]}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layer: {
    flex: 1,
  },
});
