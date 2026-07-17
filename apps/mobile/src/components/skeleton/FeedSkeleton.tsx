/**
 * FeedSkeleton — DOC_03 Section 14: "5 event cards, avatar + text lines".
 * Layout matches CommunityPulse / feed event card dimensions.
 */
import { View, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface FeedSkeletonProps {
  /** Number of event card placeholders (default 5 per spec) */
  count?: number;
}

export function FeedSkeleton({ count = 5 }: FeedSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBone variant="circle" size={40} />
          <View style={styles.textCol}>
            <SkeletonBone variant="line" width="75%" height={14} />
            <SkeletonBone variant="line" width="45%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
  },
});
