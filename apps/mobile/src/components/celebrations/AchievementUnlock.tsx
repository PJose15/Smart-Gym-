/**
 * AchievementUnlock — full-screen celebration takeover. DOC_03 Section 9.
 *
 * 8-phase timeline (~2.5s, tap anywhere to dismiss early):
 *   1. 0–300ms    overlay fades in (0 → 0.95)
 *   2. 200–700ms  badge springs up from center (scale 0 → 1.1)
 *   3. 600–900ms  badge settles (1.1 → 1.0)
 *   4. 700ms      name slides up
 *   5. 900ms      description fades in
 *   6. 1100ms     XP badge pops in
 *   7. 1500ms     confetti burst (achievement config — 40 particles, 800ms)
 *   8. 2500ms     auto-dismiss
 *
 * Under reduced motion: final state renders instantly, no confetti,
 * auto-dismiss still fires.
 *
 * Trigger contract: render when an unlock happens, pass the achievement,
 * and clear your state in `onDismiss`. For multiple unlocks, queue them and
 * pop one per onDismiss (see app/workout/complete/[id].tsx).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  RARITY_BORDER_COLORS,
  RARITY_GLOW_COLORS,
  RARITY_GLOW_RADIUS,
  RARITY_XP,
} from '../../lib/achievementDisplay';
import { ConfettiEffect } from '../effects/ConfettiEffect';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { BadgeRarity } from '@nexera/types';

const ND = Platform.OS !== 'web';
const AUTO_DISMISS_MS = 2500;

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  /** Emoji icon */
  icon: string;
  /** XP display value — defaults to rarity-based amount */
  points?: number;
  rarity: BadgeRarity;
}

interface AchievementUnlockProps {
  achievement: UnlockedAchievement;
  onDismiss: () => void;
}

export function AchievementUnlock({ achievement, onDismiss }: AchievementUnlockProps) {
  const reducedMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);
  const dismissedRef = useRef(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const nameTranslate = useRef(new Animated.Value(24)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const descOpacity = useRef(new Animated.Value(0)).current;
  const xpScale = useRef(new Animated.Value(0)).current;

  const rarityColor = RARITY_BORDER_COLORS[achievement.rarity] ?? RARITY_BORDER_COLORS.common;
  const glowColor = RARITY_GLOW_COLORS[achievement.rarity] ?? RARITY_GLOW_COLORS.common;
  const glowRadius = RARITY_GLOW_RADIUS[achievement.rarity] ?? RARITY_GLOW_RADIUS.common;
  const xp = achievement.points ?? RARITY_XP[achievement.rarity] ?? RARITY_XP.common;

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (reducedMotion) {
      onDismiss();
      return;
    }
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: ND,
    }).start(() => onDismiss());
  }, [reducedMotion, overlayOpacity, onDismiss]);

  useEffect(() => {
    dismissedRef.current = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (reducedMotion) {
      // Instant final state — Phase 8 auto-dismiss only
      overlayOpacity.setValue(0.95);
      badgeScale.setValue(1);
      nameTranslate.setValue(0);
      nameOpacity.setValue(1);
      descOpacity.setValue(1);
      xpScale.setValue(1);
      timers.push(setTimeout(handleDismiss, AUTO_DISMISS_MS));
      return () => timers.forEach(clearTimeout);
    }

    // Phase 1 — overlay fade
    Animated.timing(overlayOpacity, {
      toValue: 0.95,
      duration: 300,
      useNativeDriver: ND,
    }).start();

    // Phases 2–3 — badge spring up, then settle
    timers.push(
      setTimeout(() => {
        Animated.sequence([
          Animated.spring(badgeScale, {
            toValue: 1.1,
            tension: 60,
            friction: 6,
            useNativeDriver: ND,
          }),
          Animated.timing(badgeScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: ND,
          }),
        ]).start();
      }, 200),
    );

    // Phase 4 — name slides up
    timers.push(
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(nameOpacity, { toValue: 1, duration: 250, useNativeDriver: ND }),
          Animated.spring(nameTranslate, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: ND,
          }),
        ]).start();
      }, 700),
    );

    // Phase 5 — description fades in
    timers.push(
      setTimeout(() => {
        Animated.timing(descOpacity, { toValue: 1, duration: 250, useNativeDriver: ND }).start();
      }, 900),
    );

    // Phase 6 — XP pop
    timers.push(
      setTimeout(() => {
        Animated.spring(xpScale, {
          toValue: 1,
          tension: 120,
          friction: 6,
          useNativeDriver: ND,
        }).start();
      }, 1100),
    );

    // Phase 7 — confetti burst
    timers.push(setTimeout(() => setShowConfetti(true), 1500));

    // Phase 8 — auto-dismiss
    timers.push(setTimeout(handleDismiss, AUTO_DISMISS_MS));

    return () => timers.forEach(clearTimeout);
    // Re-run only per achievement shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.id, reducedMotion]);

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={handleDismiss}>
      <Pressable
        style={styles.root}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={`Achievement unlocked: ${achievement.name}. ${achievement.description}. Plus ${xp} XP. Tap to dismiss.`}
      >
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />

        <Animated.View
          style={[
            styles.badge,
            {
              borderColor: rarityColor,
              shadowColor: glowColor,
              shadowRadius: glowRadius,
              transform: [{ scale: badgeScale }],
            },
            achievement.rarity === 'legendary' && styles.badgeLegendary,
          ]}
        >
          <Text style={styles.badgeIcon}>{achievement.icon}</Text>
        </Animated.View>

        <Animated.View
          style={{ opacity: nameOpacity, transform: [{ translateY: nameTranslate }] }}
        >
          <Text style={styles.unlockedLabel}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.name}>{achievement.name}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: descOpacity }}>
          <Text style={styles.description}>{achievement.description}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.xpBadge,
            { borderColor: rarityColor, transform: [{ scale: xpScale }] },
          ]}
        >
          <Text style={styles.xpText}>+{xp} XP</Text>
        </Animated.View>

        {showConfetti && (
          <ConfettiEffect variant="achievement" onComplete={() => setShowConfetti(false)} />
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 22,
    borderWidth: 3,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    elevation: 12,
  },
  badgeLegendary: {
    backgroundColor: colors.surfaceHighest,
  },
  badgeIcon: {
    fontSize: 56,
    lineHeight: 68,
  },
  unlockedLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 3,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 30,
    fontFamily: typography.fontSerifBold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  xpBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.goldSubtle,
  },
  xpText: {
    fontSize: 15,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.gold,
  },
});
