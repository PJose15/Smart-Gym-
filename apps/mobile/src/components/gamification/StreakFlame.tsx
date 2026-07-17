/**
 * StreakFlame — 6-tier animated SVG flame. DOC_03 Section 8.
 * Replaces the 🔥 emoji placeholder. Tier drives color, size, sway speed,
 * flicker (tiers 3–5), glow, and tier-5 purple legend particles.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';
import {
  getStreakTierFromWeeks,
  STREAK_TIER_CONFIG,
} from '../../lib/streakTier';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ND = Platform.OS !== 'web';

let flameInstanceCounter = 0;

interface StreakFlameProps {
  /** Streak in weeks — the unit streakService measures in */
  streakWeeks: number;
  /** Override the tier-defined width in px (height is size * 1.3) */
  size?: number;
  showGlow?: boolean;
}

export function StreakFlame({ streakWeeks, size, showGlow = true }: StreakFlameProps) {
  const reducedMotion = useReducedMotion();
  const tier = getStreakTierFromWeeks(streakWeeks);
  const config = STREAK_TIER_CONFIG[tier];
  const width = size ?? config.size;
  const height = width * 1.3;

  // Unique gradient id per instance — SVG defs ids are global on web
  const gradientId = useRef(`streakFlameGrad${++flameInstanceCounter}`).current;

  const swayAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tier === 0 || reducedMotion) {
      // Static — reset to neutral pose
      swayAnim.setValue(0);
      scaleAnim.setValue(1);
      return;
    }

    // Sway — left/right oscillation
    const sway = Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, {
          toValue: 1,
          duration: config.speed / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ND,
        }),
        Animated.timing(swayAnim, {
          toValue: -1,
          duration: config.speed / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: ND,
        }),
      ]),
    );

    // Flicker — subtle scale pulse on tiers 3–5
    const flicker = config.flicker
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.08,
              duration: config.speed / 4,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: ND,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.96,
              duration: config.speed / 4,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: ND,
            }),
          ]),
        )
      : null;

    sway.start();
    flicker?.start();

    return () => {
      sway.stop();
      flicker?.stop();
      swayAnim.setValue(0);
      scaleAnim.setValue(1);
    };
  }, [tier, reducedMotion, config.speed, config.flicker, swayAnim, scaleAnim]);

  const rotate = useMemo(
    () =>
      swayAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: [`-${config.amplitude}deg`, `${config.amplitude}deg`],
      }),
    [swayAnim, config.amplitude],
  );

  return (
    <Animated.View
      accessibilityLabel={`Streak flame, tier ${tier} — ${config.name}`}
      style={{
        transform: [{ rotate }, { scale: scaleAnim }],
        shadowColor: config.glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: showGlow && tier > 0 ? 1 : 0,
        shadowRadius: width / 2,
      }}
    >
      <Svg width={width} height={height} viewBox="0 0 24 32">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="80%" r="60%">
            <Stop offset="0%" stopColor={colors.white} stopOpacity={0.9} />
            <Stop offset="40%" stopColor={config.color} stopOpacity={1} />
            <Stop
              offset="100%"
              stopColor={tier === 5 ? '#9C00FF' : colors.streakFire}
              stopOpacity={0.8}
            />
          </RadialGradient>
        </Defs>
        {/* Flame path — outer shape (spec path) */}
        <Path
          d="M12 2 C12 2 8 8 6 14 C4 20 6 24 8 26 C10 28 12 28 12 28 C12 28 14 28 16 26 C18 24 20 20 18 14 C16 8 12 2 12 2Z"
          fill={tier === 0 ? config.color : `url(#${gradientId})`}
          opacity={tier === 0 ? 0.6 : 1}
        />
        {/* Inner core — brighter center */}
        {tier > 0 && (
          <Path
            d="M12 14 C12 14 10 18 10 22 C10 24 11 26 12 26 C13 26 14 24 14 22 C14 18 12 14 12 14Z"
            fill={colors.white}
            opacity={0.6}
          />
        )}
        {/* Tier 5 — legend particles (purple sparkles) */}
        {tier === 5 && (
          <>
            <Path d="M8 8 L9 6 L10 8 L8 8Z" fill="#E040FB" opacity={0.8} />
            <Path d="M16 10 L17 8 L18 10 L16 10Z" fill="#EA80FC" opacity={0.7} />
            <Path d="M12 4 L13 2 L14 4 L12 4Z" fill="#CE93D8" opacity={0.9} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
