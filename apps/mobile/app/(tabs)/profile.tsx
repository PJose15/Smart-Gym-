import { View, StyleSheet } from 'react-native';
import { Text } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.title}>
        Profile
      </Text>
      <Text variant="body" color="textSecondary" style={styles.subtitle}>
        Sign in to track your workouts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
});
