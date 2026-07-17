/**
 * FeedEmptyState — DOC_05 §10: three variants (new_member / quiet_gym /
 * filter_empty). `filter_empty` offers a Clear Filter CTA.
 */
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export type FeedEmptyReason = 'new_member' | 'quiet_gym' | 'filter_empty';

const CONTENT: Record<FeedEmptyReason, { icon: string; title: string; description: string; cta: string | null }> = {
  new_member: {
    icon: '🏋️',
    title: 'Your gym is warming up',
    description: "When members complete workouts and hit PRs, you'll see it here.",
    cta: null,
  },
  quiet_gym: {
    icon: '💤',
    title: 'Pretty quiet today',
    description: 'No activity in the last 24 hours. Check back after peak hours.',
    cta: null,
  },
  filter_empty: {
    icon: '🔍',
    title: 'No events match this filter',
    description: 'Try clearing the filter to see all gym activity.',
    cta: 'Clear Filter',
  },
};

interface FeedEmptyStateProps {
  reason: FeedEmptyReason;
  onClearFilter?: () => void;
}

export function FeedEmptyState({ reason, onClearFilter }: FeedEmptyStateProps) {
  const content = CONTENT[reason];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{content.icon}</Text>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.description}>{content.description}</Text>
      {content.cta && onClearFilter && (
        <TouchableOpacity
          onPress={onClearFilter}
          style={styles.ctaButton}
          accessibilityRole="button"
          accessibilityLabel={content.cta}
        >
          <Text style={styles.ctaText}>{content.cta}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.h4Size,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.smallSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  ctaButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
  },
});
