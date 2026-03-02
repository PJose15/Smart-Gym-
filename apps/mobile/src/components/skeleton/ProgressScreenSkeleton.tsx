import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ProgressScreenSkeleton() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Title: "Your Progress" */}
      <SkeletonBone variant="line" width="50%" height={24} style={{ marginBottom: spacing.md }} />

      {/* Exercise cards (4) */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          {/* Header: exercise name + PR badge */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <SkeletonBone variant="line" width="65%" height={16} />
              <SkeletonBone variant="line" width="30%" height={12} style={{ marginTop: 4 }} />
            </View>
            <SkeletonBone variant="rect" width={40} height={24} borderRadius={8} />
          </View>

          {/* PR stats: 3 columns */}
          <View style={styles.prRow}>
            {[0, 1, 2].map((j) => (
              <View key={j} style={styles.prCol}>
                <SkeletonBone variant="line" width={40} height={10} />
                <SkeletonBone variant="line" width={50} height={15} style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>

          {/* "Tap for details" */}
          <SkeletonBone
            variant="line"
            width={90}
            height={12}
            style={{ alignSelf: 'center', marginTop: spacing.sm }}
          />
        </View>
      ))}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prCol: {
    flex: 1,
    alignItems: 'center',
  },
});
