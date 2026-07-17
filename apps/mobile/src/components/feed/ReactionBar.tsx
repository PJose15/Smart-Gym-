/**
 * ReactionBar — 4 reaction buttons with counts (DOC_05 §6).
 * Emoji set mirrors the web ReactionBar (strength/fire/champion/letsgo).
 * Active buttons get the purple accent treatment; a light scale pulse
 * plays on tap unless the OS requests reduced motion.
 */
import { useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { FeedReactionCounts, ReactionType } from '@nexera/types';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const REACTION_EMOJI: Record<ReactionType, string> = {
  strength: '💪',
  fire: '🔥',
  champion: '🏆',
  letsgo: '🚀',
};

const REACTION_LABEL: Record<ReactionType, string> = {
  strength: 'Strength',
  fire: 'Fire',
  champion: 'Champion',
  letsgo: "Let's go",
};

const REACTION_TYPES: ReactionType[] = ['strength', 'fire', 'champion', 'letsgo'];

interface ReactionBarProps {
  reactions: FeedReactionCounts;
  myReactions: ReactionType[];
  onToggle: (type: ReactionType) => void;
}

function ReactionButton({
  type,
  count,
  isActive,
  onToggle,
}: {
  type: ReactionType;
  count: number;
  isActive: boolean;
  onToggle: (type: ReactionType) => void;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (!reducedMotion) {
      scale.setValue(1);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.18, tension: 300, friction: 6, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 300, friction: 6, useNativeDriver: true }),
      ]).start();
    }
    onToggle(type);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[styles.button, isActive && styles.buttonActive]}
        accessibilityRole="button"
        accessibilityLabel={`${REACTION_LABEL[type]} reaction, ${count} ${count === 1 ? 'reaction' : 'reactions'}`}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={styles.emoji}>{REACTION_EMOJI[type]}</Text>
        {count > 0 && (
          <Text style={[styles.count, isActive && styles.countActive]}>{count}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ReactionBar({ reactions, myReactions, onToggle }: ReactionBarProps) {
  return (
    <View style={styles.row}>
      {REACTION_TYPES.map((type) => (
        <ReactionButton
          key={type}
          type={type}
          count={reactions[type]}
          isActive={myReactions.includes(type)}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  buttonActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  emoji: {
    fontSize: 14,
  },
  count: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  countActive: {
    color: colors.primary,
  },
});
