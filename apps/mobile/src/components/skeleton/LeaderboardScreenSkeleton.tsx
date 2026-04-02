import { View, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function LeaderboardScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header: Back + Title */}
      <View style={styles.header}>
        <SkeletonBone variant="line" width={40} height={16} />
        <SkeletonBone variant="line" width={140} height={24} style={{ marginLeft: spacing.md }} />
      </View>

      {/* Period toggle */}
      <SkeletonBone
        variant="rect"
        width="100%"
        height={40}
        borderRadius={12}
        style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}
      />

      {/* Leaderboard rows (8) — row 3 highlighted as "current user" */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} style={[styles.row, i === 3 && styles.rowHighlight]}>
          {/* Rank */}
          <SkeletonBone variant="line" width={24} height={16} />
          {/* Avatar */}
          <SkeletonBone variant="circle" size={36} style={{ marginLeft: spacing.sm }} />
          {/* Name */}
          <SkeletonBone
            variant="line"
            width="40%"
            height={15}
            style={{ marginLeft: spacing.sm }}
          />
          {/* Spacer */}
          <View style={{ flex: 1 }} />
          {/* Points */}
          <SkeletonBone variant="line" width={50} height={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowHighlight: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 8,
  },
});
