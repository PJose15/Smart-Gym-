/**
 * FeedFilterBar — horizontal filter chips (DOC_05 §4/§17).
 * All / PRs / Achievements / Streaks / Challenges.
 */
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { FEED_FILTERS, type FeedFilter } from '../../lib/feedLogic';

interface FeedFilterBarProps {
  activeFilter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
}

export function FeedFilterBar({ activeFilter, onFilterChange }: FeedFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {FEED_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;
        return (
          <TouchableOpacity
            key={filter.key}
            onPress={() => onFilterChange(filter.key)}
            style={[styles.chip, isActive && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${filter.label}`}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  chipText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
