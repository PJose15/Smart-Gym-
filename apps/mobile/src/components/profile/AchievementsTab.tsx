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
import { RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeService';
import {
  getBadgeProgress,
  RARITY_DIFFICULTY,
  RARITY_XP,
} from '../../lib/achievementDisplay';
import { StreakFlame } from '../gamification/StreakFlame';
import type { BadgeWithStatus } from '@nexera/types';
import type { StreakResult } from '../../lib/streakService';

type RarityFilter = 'all' | 'legendary' | 'epic' | 'rare' | 'common';

const FILTER_CHIPS: { key: RarityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'epic', label: 'Epic' },
  { key: 'rare', label: 'Rare' },
  { key: 'common', label: 'Common' },
];

interface AchievementsTabProps {
  badges: BadgeWithStatus[];
  streak: StreakResult | null;
  totalPoints: number;
  /** Optional — enables progress bars on workout-count badges */
  completedWorkouts?: number;
  /** Optional — enables progress bars on volume badges */
  totalVolumeKg?: number;
}

export function AchievementsTab({ badges, streak, totalPoints, completedWorkouts, totalVolumeKg }: AchievementsTabProps) {
  const [filter, setFilter] = useState<RarityFilter>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null);

  const filtered = filter === 'all'
    ? badges
    : badges.filter((b) => b.rarity === filter);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  // Progress toward the selected locked badge (null = not derivable → hidden)
  const selectedProgress = selectedBadge && !selectedBadge.unlocked
    ? getBadgeProgress(selectedBadge.criteria_type, selectedBadge.criteria_value, {
        completedWorkouts,
        longestStreak: streak?.longestStreak,
        totalVolumeKg,
        totalPoints,
      })
    : null;

  return (
    <View>
      {/* Streak */}
      {streak && streak.currentStreak > 0 && (
        <Card style={styles.streakCard}>
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
        <Text variant="caption" color="textSecondary">total points</Text>
      </View>

      {/* Badges */}
      {badges.length > 0 && (
        <>
          <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
            Badges ({unlockedCount}/{badges.length})
          </Text>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.filterRow}>
              {FILTER_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.filterChip, filter === chip.key && styles.filterChipActive]}
                  onPress={() => setFilter(chip.key)}
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

          <Card style={styles.card}>
            <View style={styles.badgeGrid}>
              {filtered.map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeCell, !badge.unlocked && styles.badgeLocked]}
                  onPress={() => setSelectedBadge(badge)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    badge.unlocked
                      ? `${badge.name} badge, unlocked`
                      : `${badge.name} badge, locked`
                  }
                  accessibilityHint="Shows badge details"
                >
                  <Text style={styles.badgeEmoji}>
                    {badge.unlocked ? badge.icon_emoji : '\uD83D\uDD12'}
                  </Text>
                  <Text
                    style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}
                    numberOfLines={1}
                  >
                    {badge.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
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
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>
              {selectedBadge?.unlocked ? selectedBadge.icon_emoji : '\uD83D\uDD12'}
            </Text>
            <Text style={styles.modalName}>{selectedBadge?.name}</Text>
            {selectedBadge && (
              <View style={[
                styles.rarityTag,
                { backgroundColor: (RARITY_COLORS[selectedBadge.rarity] ?? colors.textSecondary) + '20' },
              ]}>
                <Text style={[
                  styles.rarityText,
                  { color: RARITY_COLORS[selectedBadge.rarity] ?? colors.textSecondary },
                ]}>
                  {RARITY_LABELS[selectedBadge.rarity] ?? selectedBadge.rarity}
                </Text>
              </View>
            )}
            <Text style={styles.modalDesc}>{selectedBadge?.description}</Text>

            {/* Earned: date + XP awarded */}
            {selectedBadge?.unlocked && (
              <>
                {selectedBadge.unlocked_at && (
                  <Text style={styles.modalDate}>
                    Unlocked {new Date(selectedBadge.unlocked_at).toLocaleDateString()}
                  </Text>
                )}
                <View style={styles.xpRow}>
                  <Text style={styles.xpValue}>+{RARITY_XP[selectedBadge.rarity] ?? 0} XP</Text>
                </View>
              </>
            )}

            {/* Locked: progress (when derivable) + difficulty */}
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
                  Difficulty: {RARITY_DIFFICULTY[selectedBadge.rarity] ?? 'Unknown'}
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
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    marginBottom: spacing.md,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakCount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber,
    lineHeight: 26,
  },
  streakBonusBadge: {
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  streakBonusText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  streakNudge: {
    marginTop: spacing.sm,
    color: colors.amber,
    fontStyle: 'italic',
  },
  pointsHeader: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  pointsTotal: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 44,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  filterScroll: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCell: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  badgeLocked: { opacity: 0.4 },
  badgeEmoji: { fontSize: 28, marginBottom: 4 },
  badgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: { color: colors.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalEmoji: { fontSize: 56, marginBottom: spacing.md },
  modalName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  rarityTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  rarityText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  modalDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  xpRow: {
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  xpValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.xp,
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
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  modalLocked: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  modalClose: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
