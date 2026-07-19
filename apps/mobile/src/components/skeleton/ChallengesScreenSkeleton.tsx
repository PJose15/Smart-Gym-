/**
 * ChallengesScreenSkeleton — loading placeholder for the Challenges list screen.
 *
 * Layout matches ChallengeCard structure:
 *   - Toggle bar bone
 *   - 4 card-shaped bones with inner row bones for badge + countdown
 *
 * Follows FeedSkeleton.tsx conventions: SkeletonBone with Shimmer.
 */
import { View, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ChallengesScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Toggle bar — two segment buttons */}
      <View style={styles.toggleBar}>
        <SkeletonBone variant="rect" width="45%" height={36} borderRadius={10} />
        <SkeletonBone variant="rect" width="45%" height={36} borderRadius={10} />
      </View>

      {/* 4 challenge card placeholders */}
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.card}>
          {/* Row 1: type badge + countdown */}
          <View style={styles.row1}>
            <SkeletonBone variant="line" width={72} height={22} borderRadius={11} />
            <SkeletonBone variant="line" width={60} height={22} borderRadius={11} />
          </View>
          {/* Row 2: title */}
          <SkeletonBone variant="line" width="70%" height={18} />
          {/* Row 3: description (2 lines) */}
          <SkeletonBone variant="line" width="90%" height={13} />
          <SkeletonBone variant="line" width="60%" height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toggleBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
