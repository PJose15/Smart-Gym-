import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBone } from './SkeletonBone';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function HomeScreenSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Dark header bar matching actual screen */}
      <View style={styles.header}>
        <SkeletonBone variant="line" width="40%" height={18} borderRadius={4} />
      </View>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Greeting: "Hey, Name 👋" */}
      <SkeletonBone variant="line" width="55%" height={28} style={{ marginBottom: spacing.lg }} />

      {/* Streak badge pill */}
      <SkeletonBone
        variant="rect"
        width={170}
        height={32}
        borderRadius={20}
        style={{ marginBottom: spacing.md }}
      />

      {/* Leaderboard CTA card */}
      <View style={styles.card}>
        <SkeletonBone variant="line" width="65%" height={14} />
        <SkeletonBone variant="line" width="35%" height={12} style={{ marginTop: spacing.sm }} />
      </View>

      {/* Section title: "Today: Day Name" */}
      <SkeletonBone
        variant="line"
        width="40%"
        height={13}
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
      />

      {/* Exercise cards (3) */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.exerciseCard}>
          <SkeletonBone variant="line" width="70%" height={15} />
          <SkeletonBone variant="line" width="35%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}

      {/* "Why This Today?" explanation card */}
      <View style={[styles.card, styles.explanationCard]}>
        <SkeletonBone variant="line" width="40%" height={13} />
        <SkeletonBone variant="line" width="100%" height={12} style={{ marginTop: spacing.sm }} />
        <SkeletonBone variant="line" width="85%" height={12} style={{ marginTop: 4 }} />
        {/* Muscle tags */}
        <View style={styles.chipRow}>
          <SkeletonBone variant="rect" width={60} height={22} borderRadius={12} />
          <SkeletonBone variant="rect" width={75} height={22} borderRadius={12} />
          <SkeletonBone variant="rect" width={55} height={22} borderRadius={12} />
        </View>
      </View>

      {/* AI Coaching card */}
      <View style={[styles.card, styles.coachingCard]}>
        <SkeletonBone variant="line" width="25%" height={13} />
        <SkeletonBone variant="line" width="100%" height={12} style={{ marginTop: spacing.sm }} />
        <SkeletonBone variant="line" width="75%" height={12} style={{ marginTop: 4 }} />
        {/* Action items */}
        <View style={{ marginTop: spacing.sm }}>
          <View style={styles.bulletRow}>
            <SkeletonBone variant="circle" size={6} />
            <SkeletonBone variant="line" width="80%" height={12} style={{ marginLeft: 8 }} />
          </View>
          <View style={[styles.bulletRow, { marginTop: 6 }]}>
            <SkeletonBone variant="circle" size={6} />
            <SkeletonBone variant="line" width="65%" height={12} style={{ marginLeft: 8 }} />
          </View>
        </View>
      </View>

      {/* Start Workout button */}
      <SkeletonBone
        variant="rect"
        width="100%"
        height={52}
        borderRadius={12}
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
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
  exerciseCard: {
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
  explanationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
    marginTop: spacing.sm,
  },
  coachingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
