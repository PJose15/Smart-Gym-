import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function MachineDetailSkeleton() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Hero image */}
      <SkeletonBone
        variant="rect"
        width="100%"
        height={200}
        borderRadius={12}
        style={{ marginBottom: spacing.md }}
      />

      {/* Machine name */}
      <SkeletonBone variant="line" width="60%" height={24} style={{ marginBottom: 4 }} />

      {/* Gym name */}
      <SkeletonBone variant="line" width="35%" height={13} style={{ marginBottom: spacing.md }} />

      {/* Muscle chips */}
      <View style={styles.chipRow}>
        <SkeletonBone variant="rect" width={75} height={28} borderRadius={16} />
        <SkeletonBone variant="rect" width={90} height={28} borderRadius={16} />
        <SkeletonBone variant="rect" width={65} height={28} borderRadius={16} />
      </View>

      {/* Setup Instructions card */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <SkeletonBone variant="line" width="50%" height={17} style={{ marginBottom: spacing.md }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.bulletRow, i > 0 && { marginTop: spacing.sm }]}>
            <SkeletonBone variant="circle" size={24} />
            <SkeletonBone variant="line" width="80%" height={14} style={{ marginLeft: spacing.sm }} />
          </View>
        ))}
      </View>

      {/* Safety Cues card */}
      <View style={styles.card}>
        <SkeletonBone variant="line" width="40%" height={17} style={{ marginBottom: spacing.md }} />
        {[0, 1].map((i) => (
          <View key={i} style={[styles.bulletRow, i > 0 && { marginTop: spacing.sm }]}>
            <SkeletonBone variant="circle" size={20} />
            <SkeletonBone variant="line" width="75%" height={14} style={{ marginLeft: spacing.sm }} />
          </View>
        ))}
      </View>

      {/* Common Mistakes card */}
      <View style={styles.card}>
        <SkeletonBone variant="line" width="50%" height={17} style={{ marginBottom: spacing.md }} />
        {[0, 1].map((i) => (
          <View key={i} style={[styles.bulletRow, i > 0 && { marginTop: spacing.sm }]}>
            <SkeletonBone variant="circle" size={20} />
            <SkeletonBone variant="line" width="70%" height={14} style={{ marginLeft: spacing.sm }} />
          </View>
        ))}
      </View>

      {/* Start Workout button */}
      <SkeletonBone
        variant="rect"
        width="100%"
        height={48}
        borderRadius={12}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
