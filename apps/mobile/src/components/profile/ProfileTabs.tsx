import { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export type ProfileTabKey = 'overview' | 'achievements' | 'dna' | 'bodymap';

const TABS: { key: ProfileTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'dna', label: 'DNA' },
  { key: 'bodymap', label: 'Body Map' },
];

interface ProfileTabsProps {
  activeTab: ProfileTabKey;
  onTabChange: (tab: ProfileTabKey) => void;
}

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  const tabWidths = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(60)).current;

  const handleTabLayout = (key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    tabWidths.current[key] = { x, width };
    if (key === activeTab) {
      indicatorX.setValue(x);
      indicatorW.setValue(width);
    }
  };

  useEffect(() => {
    const layout = tabWidths.current[activeTab];
    if (layout) {
      Animated.parallel([
        Animated.spring(indicatorX, {
          toValue: layout.x,
          tension: 300,
          friction: 30,
          useNativeDriver: false,
        }),
        Animated.spring(indicatorW, {
          toValue: layout.width,
          tension: 300,
          friction: 30,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            onLayout={(e) => handleTabLayout(tab.key, e)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Animated.View
        style={[
          styles.indicator,
          {
            left: indicatorX,
            width: indicatorW,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
});
