import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ProfileScreenSkeleton() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Avatar + name + email */}
      <View style={styles.avatarSection}>
        <SkeletonBone variant="circle" size={80} style={{ marginBottom: spacing.md }} />
        <SkeletonBone variant="line" width="45%" height={24} />
        <SkeletonBone variant="line" width="55%" height={14} style={{ marginTop: spacing.xs }} />
      </View>

      {/* Streak section */}
      <SkeletonBone variant="line" width={60} height={11} style={{ marginBottom: spacing.xs }} />
      <View style={styles.card}>
        <View style={styles.streakRow}>
          <SkeletonBone variant="circle" size={40} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <SkeletonBone variant="line" width="50%" height={20} />
            <SkeletonBone variant="line" width="40%" height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>

      {/* Badges section */}
      <SkeletonBone
        variant="line"
        width={70}
        height={11}
        style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}
      />
      <View style={styles.card}>
        <View style={styles.badgeGrid}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={styles.badgeCell}>
              <SkeletonBone variant="circle" size={28} />
              <SkeletonBone variant="line" width={36} height={10} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      </View>

      {/* Preferences */}
      <SkeletonBone
        variant="line"
        width={90}
        height={11}
        style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}
      />
      <View style={styles.card}>
        <View style={styles.prefRow}>
          <SkeletonBone variant="line" width={90} height={15} />
          <SkeletonBone variant="rect" width={80} height={32} borderRadius={10} />
        </View>
      </View>

      {/* Points */}
      <SkeletonBone
        variant="line"
        width={50}
        height={11}
        style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}
      />
      <View style={styles.card}>
        <View style={styles.pointsCenter}>
          <SkeletonBone variant="line" width={80} height={36} />
          <SkeletonBone variant="line" width={70} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
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
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeCell: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsCenter: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
