import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.title}>
        Welcome to SmartGym
      </Text>
      <Text variant="body" color="textSecondary" style={styles.subtitle}>
        Scan a QR code on any machine to get started
      </Text>
      <Button
        title="Scan Machine QR"
        onPress={() => router.push('/(tabs)/scan')}
      />
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
    marginBottom: spacing.xl,
  },
});
