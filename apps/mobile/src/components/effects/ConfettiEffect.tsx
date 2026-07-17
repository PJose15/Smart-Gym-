/**
 * ConfettiEffect — Animated-API particle burst. DOC_03 Sections 11 + 20.
 *
 * Three variants: 'pr' (120/800ms), 'achievement' (40/800ms),
 * 'levelup' (80/1000ms). One shared progress value drives every particle via
 * per-particle interpolations — native-driver transforms + opacity only
 * (no layout props). Renders nothing under reduced motion.
 *
 * Mount to play: `{burst && <ConfettiEffect variant="pr" onComplete={...} />}`
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  ConfettiParticle,
  ConfettiVariant,
  CONFETTI_CONFIGS,
  generateParticles,
} from '../../lib/confettiConfig';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ND = Platform.OS !== 'web';

interface ConfettiEffectProps {
  variant: ConfettiVariant;
  onComplete?: () => void;
}

function ParticleView({
  particle,
  progress,
}: {
  particle: ConfettiParticle;
  progress: Animated.Value;
}) {
  const d = Math.min(particle.delayRatio, 0.9);
  const peakAt = d + (1 - d) * 0.35;
  const fadeAt = Math.max(peakAt + 0.01, 0.8);

  const translateY = progress.interpolate({
    inputRange: [0, d, peakAt, 1],
    outputRange: [0, 0, particle.peakY, particle.fallY],
    extrapolate: 'clamp',
  });
  const translateX = progress.interpolate({
    inputRange: [0, d, 1],
    outputRange: [0, 0, particle.driftX],
    extrapolate: 'clamp',
  });
  const rotate = progress.interpolate({
    inputRange: [0, d, 1],
    outputRange: ['0deg', '0deg', `${particle.rotation}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, Math.max(d - 0.01, 0), d, fadeAt, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  const isRibbon = particle.shape === 'ribbon';
  const width = isRibbon ? particle.size * 0.45 : particle.size;
  const height = isRibbon ? particle.size * 2 : particle.size;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: `${50 + particle.startXRatio * 100}%`,
        width,
        height,
        backgroundColor: particle.color,
        borderRadius: particle.shape === 'circle' ? particle.size / 2 : 1,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }],
      }}
    />
  );
}

export function ConfettiEffect({ variant, onComplete }: ConfettiEffectProps) {
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const particles = useMemo(() => generateParticles(variant), [variant]);
  const config = CONFETTI_CONFIGS[variant];

  useEffect(() => {
    if (reducedMotion) {
      // No motion — resolve immediately so celebration flows continue
      const id = setTimeout(() => onCompleteRef.current?.(), 0);
      return () => clearTimeout(id);
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: config.duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: ND,
    });
    animation.start(({ finished }) => {
      if (finished) onCompleteRef.current?.();
    });
    return () => animation.stop();
  }, [reducedMotion, progress, config.duration]);

  if (reducedMotion) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Emit from upper-third of screen so particles rise then cascade */}
      <View style={{ position: 'absolute', top: windowHeight * 0.3, left: 0, right: 0 }}>
        {particles.map((p) => (
          <ParticleView key={p.key} particle={p} progress={progress} />
        ))}
      </View>
    </View>
  );
}
