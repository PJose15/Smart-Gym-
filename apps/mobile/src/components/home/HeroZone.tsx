/**
 * HeroZone — The personal greeting card at the top of the home screen.
 * Full-bleed, variant-driven, time-aware. Based on DOC_07 Part 2C.
 * Restyled to the NEXTERA Red-Luxury system (design/stitch): 22px featured
 * card, hairline border, serif brand headline, mono metric, crimson glow.
 */
import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { StreakFlame } from '../gamification/StreakFlame';
import type { HeroState } from '../../lib/heroState';

const ND = Platform.OS !== 'web';

interface HeroZoneProps {
  hero: HeroState;
  firstName: string;
  avatarUrl?: string | null;
  level: number;
  streak: number;
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <View style={streakStyles.badge}>
      <StreakFlame streakWeeks={streak} size={14} />
      <Text style={streakStyles.text}>{streak}</Text>
    </View>
  );
}

function MemberAvatar({ avatarUrl, name, level }: { avatarUrl?: string | null; name: string; level: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={avatarStyles.container}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={avatarStyles.image} />
      ) : (
        <View style={avatarStyles.fallback}>
          <Text style={avatarStyles.initials}>{initials}</Text>
        </View>
      )}
      <View style={avatarStyles.levelBadge}>
        <Text style={avatarStyles.levelText}>{level}</Text>
      </View>
    </View>
  );
}

export function HeroZone({ hero, firstName, avatarUrl, level, streak }: HeroZoneProps) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const metricScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: ND,
        }),
        Animated.spring(slideUp, {
          toValue: 0,
          tension: 40,
          friction: 7,
          useNativeDriver: ND,
        }),
      ]),
      Animated.spring(metricScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: ND,
      }),
    ]).start();
  }, [hero.variant]);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[hero.gradientColors[0], hero.gradientColors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Emissive corner glow (tonal depth, no drop shadow) */}
        <View style={[styles.accentGlow, { backgroundColor: hero.accentColor }]} />

        <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          {/* Identity row: avatar, greeting+name, streak */}
          <View style={styles.identityRow}>
            <MemberAvatar avatarUrl={avatarUrl} name={firstName} level={level} />
            <View style={styles.identityText}>
              <Text style={[styles.greeting, { color: hero.accentColor }]}>
                {hero.greeting}
              </Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <StreakBadge streak={streak} />
          </View>

          {/* Dynamic message */}
          <View style={styles.messageBlock}>
            <Text style={styles.headline}>{hero.headline}</Text>
            <Text style={styles.subline}>{hero.subline}</Text>
          </View>

          {/* Hero metric */}
          {hero.metric && (
            <Animated.View style={[styles.metricContainer, { transform: [{ scale: metricScale }] }]}>
              <Text style={[styles.metricValue, { color: hero.accentColor }]}>
                {hero.metric.value}
              </Text>
              <Text style={styles.metricLabel}>{hero.metric.label}</Text>
            </Animated.View>
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.14,
  },
  content: {
    gap: spacing.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityText: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Serif brand moment — the greeting headline (Playfair Display)
  name: {
    fontSize: 30,
    fontFamily: typography.fontSerifBold,
    color: colors.text,
    marginTop: 2,
  },
  messageBlock: {
    gap: 6,
  },
  headline: {
    fontSize: typography.h3Size,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    lineHeight: 26,
  },
  subline: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  metricContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  // Numbers are heroes — mono, big
  metricValue: {
    fontSize: 28,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

const streakStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 5,
  },
  text: {
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
    color: colors.amber,
  },
});

const avatarStyles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.borderAccent,
  },
  fallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 18,
    fontFamily: typography.fontBold,
    color: colors.textSecondary,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  levelText: {
    fontSize: 10,
    fontFamily: typography.fontBold,
    color: colors.white,
  },
});
