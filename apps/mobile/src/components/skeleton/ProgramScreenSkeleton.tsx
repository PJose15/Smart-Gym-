/**
 * ProgramScreenSkeleton — loading placeholder for the program screen.
 *
 * Layout:
 *   - Header block: title line + chips row + progress bar
 *   - 3× day-card rectangles
 *
 * Follows ChallengesScreenSkeleton.tsx conventions: SkeletonBone composition.
 */
import { View, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { spacing } from '../../theme/spacing';

export function ProgramScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header block */}
      <View style={styles.headerBlock}>
        <SkeletonBone variant="line" width="40%" height={12} borderRadius={6} />
        <SkeletonBone variant="line" width="60%" height={22} borderRadius={6} style={{ marginTop: spacing.xs }} />
        <View style={styles.chipsRow}>
          <SkeletonBone variant="line" width={64} height={22} borderRadius={11} />
          <SkeletonBone variant="line" width={56} height={22} borderRadius={11} />
          <SkeletonBone variant="line" width={80} height={22} borderRadius={11} />
        </View>
        <SkeletonBone variant="rect" width="100%" height={8} borderRadius={4} style={{ marginTop: spacing.xs }} />
      </View>

      {/* 3 day card placeholders */}
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonBone key={i} variant="rect" width="100%" height={110} borderRadius={14} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
