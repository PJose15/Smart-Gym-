/**
 * HeroZone — The personal greeting card at the top of the home screen.
 * Full-bleed, variant-driven, time-aware. Based on DOC_07 Part 2C.
 */
import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
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
    <LinearGradient
      colors={[hero.gradientColors[0], hero.gradientColors[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Accent glow */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.08,
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
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  messageBlock: {
    gap: 6,
  },
  headline: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 26,
  },
  subline: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  metricContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
  },
});

const streakStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberSubtle,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  fallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.purple,
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
    fontWeight: '700',
    color: colors.white,
  },
});
