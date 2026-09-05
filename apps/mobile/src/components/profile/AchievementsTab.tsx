import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Text } from '../Text';
import { Card } from '../Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  getBadgeEmoji,
  getBadgeProgress,
  getPointsTier,
  POINTS_TIER_COLORS,
  POINTS_TIER_GLOW_COLORS,
  POINTS_TIER_LABELS,
  POINTS_TIER_SUBTLE_COLORS,
} from '../../lib/achievementDisplay';
import type { PointsTier } from '../../lib/achievementDisplay';
import { StreakFlame } from '../gamification/StreakFlame';
import type { AchievementCategory, BadgeWithStatus } from '../../lib/badgeService';
import type { StreakResult } from '../../lib/streakService';

type CategoryFilter = 'all' | AchievementCategory;

const FILTER_CHIPS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'performance', label: 'Performance' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'explorer', label: 'Explorer' },
  { key: 'community', label: 'Community' },
];

// Metallic tier treatment per design.md "Achievement badge" — points-tier
// colored border + glow: gold ≥500 pts, silver 200–499, bronze <200.
function tierStyle(tier: PointsTier): { color: string; subtle: string; glow: string } {
  return {
    color: POINTS_TIER_COLORS[tier],
    subtle: POINTS_TIER_SUBTLE_COLORS[tier],
    glow: POINTS_TIER_GLOW_COLORS[tier],
  };
}

const DEFAULT_TIER = { color: colors.textSecondary, subtle: colors.surfaceHighest, glow: colors.transparent };

interface AchievementsTabProps {
  badges: BadgeWithStatus[];
  streak: StreakResult | null;
  totalPoints: number;
  /** Optional — enables progress bars on session-count badges */
  completedWorkouts?: number;
  /** Optional — enables progress bars on volume badges (stored unit: lbs) */
  totalVolumeLbs?: number;
  /** Optional — enables progress bars on day-streak badges */
  streakDays?: number;
}

export function AchievementsTab({ badges, streak, totalPoints, completedWorkouts, totalVolumeLbs, streakDays }: AchievementsTabProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null);

  const filtered = filter === 'all'
    ? badges
    : badges.filter((b) => b.category === filter);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  // Progress toward the selected locked badge (null = not derivable → hidden)
  const selectedProgress = selectedBadge && !selectedBadge.unlocked
    ? getBadgeProgress(selectedBadge, {
        sessions: completedWorkouts,
        lbs: totalVolumeLbs,
        days: streakDays,
      })
    : null;

  const selectedTier = selectedBadge
    ? tierStyle(getPointsTier(selectedBadge.points))
    : DEFAULT_TIER;

  return (
    <View>
      {/* Streak */}
      {streak && streak.currentStreak > 0 && (
        <Card style={styles.streakCard}>
          <View style={styles.streakGlow} pointerEvents="none" />
          <View style={styles.streakRow}>
            <StreakFlame streakWeeks={streak.currentStreak} />
            <View style={{ flex: 1 }}>
              <Text variant="heading" style={styles.streakCount}>
                {streak.currentStreak} week{streak.currentStreak !== 1 ? 's' : ''}
              </Text>
              <Text variant="caption" color="textSecondary">
                Longest: {streak.longestStreak} week{streak.longestStreak !== 1 ? 's' : ''}
              </Text>
            </View>
            {streak.bonusPoints > 0 && (
              <View style={styles.streakBonusBadge}>
                <Text style={styles.streakBonusText}>+{streak.bonusPoints}</Text>
              </View>
            )}
          </View>
          {!streak.currentWeekActive && (
            <Text variant="caption" style={styles.streakNudge}>
              Work out this week to keep your streak!
            </Text>
          )}
        </Card>
      )}

      {/* Points */}
      <View style={styles.pointsHeader}>
        <Text style={styles.pointsTotal}>{totalPoints.toLocaleString()}</Text>
        <Text style={styles.pointsLabel}>TOTAL POINTS</Text>
      </View>

      {/* Badges */}
      {badges.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            ACHIEVEMENTS <Text style={styles.sectionCount}>{unlockedCount}/{badges.length}</Text>
          </Text>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.filterRow}>
              {FILTER_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.filterChip, filter === chip.key && styles.filterChipActive]}
                  onPress={() => setFilter(chip.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter achievements: ${chip.label}`}
                  accessibilityState={{ selected: filter === chip.key }}
                >
                  <Text
                    style={[styles.filterText, filter === chip.key && styles.filterTextActive]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.badgeGrid}>
            {filtered.map((badge) => {
              const tier = tierStyle(getPointsTier(badge.points));
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    styles.badgeCell,
                    badge.unlocked
                      ? {
                          borderColor: tier.color,
                          backgroundColor: tier.subtle,
                          shadowColor: tier.color,
                        }
                      : styles.badgeLocked,
                  ]}
                  onPress={() => setSelectedBadge(badge)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    badge.unlocked
                      ? `${badge.title} badge, unlocked`
                      : `${badge.title} badge, locked`
                  }
                  accessibilityHint="Shows badge details"
                >
                  <Text style={[styles.badgeEmoji, !badge.unlocked && styles.badgeEmojiLocked]}>
                    {badge.unlocked ? getBadgeEmoji(badge) : '🔒'}
                  </Text>
                  <Text
                    style={[
                      styles.badgeName,
                      badge.unlocked ? { color: tier.color } : styles.badgeNameLocked,
                    ]}
                    numberOfLines={1}
                  >
                    {badge.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Badge Detail Modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBadge(null)}
          accessibilityRole="button"
          accessibilityLabel="Close badge details"
        >
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalEmojiRing,
                selectedBadge?.unlocked && {
                  borderColor: selectedTier.color,
                  backgroundColor: selectedTier.subtle,
                  shadowColor: selectedTier.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.55,
                  shadowRadius: 16,
                },
              ]}
            >
              <Text style={styles.modalEmoji}>
                {selectedBadge
                  ? selectedBadge.unlocked ? getBadgeEmoji(selectedBadge) : '🔒'
                  : '🔒'}
              </Text>
            </View>
            <Text style={styles.modalName}>{selectedBadge?.title}</Text>
            {selectedBadge && (
              <View style={[
                styles.tierTag,
                {
                  backgroundColor: selectedTier.subtle,
                  borderColor: selectedTier.color,
                },
              ]}>
                <Text style={[styles.tierText, { color: selectedTier.color }]}>
                  {POINTS_TIER_LABELS[getPointsTier(selectedBadge.points)]}
                </Text>
              </View>
            )}
            <Text style={styles.modalDesc}>{selectedBadge?.description}</Text>

            {/* Earned: date + points awarded */}
            {selectedBadge?.unlocked && (
              <>
                {selectedBadge.earned_at && (
                  <Text style={styles.modalDate}>
                    Unlocked {new Date(selectedBadge.earned_at).toLocaleDateString()}
                  </Text>
                )}
                <View style={styles.xpRow}>
                  <Text style={styles.xpValue}>+{selectedBadge.points} PTS</Text>
                </View>
              </>
            )}

            {/* Locked: progress (when derivable) + points on offer */}
            {selectedBadge && !selectedBadge.unlocked && (
              <>
                {selectedProgress && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(selectedProgress.ratio * 100)}%` as `${number}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>{selectedProgress.label}</Text>
                  </View>
                )}
                <Text style={styles.modalLocked}>
                  Worth +{selectedBadge.points} PTS
                </Text>
              </>
            )}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedBadge(null)}
              accessibilityRole="button"
              accessibilityLabel={
                selectedBadge && !selectedBadge.unlocked ? 'Keep training' : 'Close'
              }
            >
              <Text style={styles.modalCloseText}>
                {selectedBadge && !selectedBadge.unlocked ? 'Keep training' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  streakGlow: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.amberSubtle,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakCount: {
    fontSize: 22,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -0.5,
    color: colors.amber,
    lineHeight: 26,
  },
  streakBonusBadge: {
    backgroundColor: colors.amberSubtle,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 9999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  streakBonusText: {
    color: colors.amber,
    fontSize: 12,
    fontFamily: typography.fontMonoBold,
  },
  streakNudge: {
    marginTop: spacing.sm,
    color: colors.amber,
  },
  pointsHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  pointsTotal: {
    fontSize: 40,
    fontFamily: typography.fontMonoBold,
    letterSpacing: -1.2,
    color: colors.primaryLight,
    lineHeight: 44,
  },
  pointsLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
    letterSpacing: 0,
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  filterText: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primaryLight,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  badgeCell: {
    flexBasis: '30%',
    flexGrow: 1,
    maxWidth: '32%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    // Tier glow (shadowColor overridden per tier on unlocked cells)
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 0,
  },
  badgeLocked: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  badgeEmoji: { fontSize: 28, marginBottom: spacing.sm },
  badgeEmojiLocked: { opacity: 0.7 },
  badgeName: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 0.4,
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: { color: colors.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalEmojiRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHighest,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalEmoji: { fontSize: 48 },
  modalName: {
    fontSize: 22,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tierTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  tierText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalDesc: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  modalDate: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  xpRow: {
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
    borderRadius: 9999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  xpValue: {
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
  },
  progressSection: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceHighest,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  modalLocked: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  modalClose: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
  },
  modalCloseText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontFamily: typography.fontSemiBold,
  },
});
