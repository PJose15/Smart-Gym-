import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import type { Machine } from '@smartgym/types';
import { Button, Text, Card } from '../../src/components';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

interface MachineWithGym extends Machine {
  gym_name: string;
}

export default function MachineDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<MachineWithGym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMachine = async () => {
    if (!slug) {
      setError('No machine identifier provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_machine_by_slug', { slug })
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeout);

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Machine not found');

      setMachine(data as MachineWithGym);
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load machine');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachine();
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="textSecondary" style={styles.loadingText}>
          Loading machine...
        </Text>
      </View>
    );
  }

  if (error || !machine) {
    return (
      <View style={styles.centered}>
        <Text variant="heading" style={styles.errorTitle}>
          Machine Not Found
        </Text>
        <Text variant="body" color="textSecondary" style={styles.errorText}>
          {error || 'This QR code does not match any machine.'}
        </Text>
        <Button title="Try Again" onPress={fetchMachine} style={styles.button} />
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {machine.image_url && (
        <Image source={{ uri: machine.image_url }} style={styles.image} resizeMode="cover" />
      )}

      <Text variant="heading">{machine.name}</Text>
      {machine.gym_name && (
        <Text variant="caption" style={styles.gymName}>
          {machine.gym_name}
        </Text>
      )}

      {machine.target_muscles.length > 0 && (
        <View style={styles.chipsContainer}>
          {machine.target_muscles.map((muscle, i: number) => (
            <View key={i} style={styles.chip}>
              <Text variant="caption" color="white">
                {muscle}
              </Text>
            </View>
          ))}
        </View>
      )}

      {machine.setup_steps.length > 0 && (
        <Card style={styles.section}>
          <Text variant="subheading" style={styles.sectionTitle}>
            Setup Instructions
          </Text>
          {machine.setup_steps.map((step, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletNumber}>
                <Text variant="caption" color="white">
                  {i + 1}
                </Text>
              </View>
              <Text variant="body" style={styles.bulletText}>
                {step}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {machine.safety_cues.length > 0 && (
        <Card style={styles.section}>
          <Text variant="subheading" style={styles.sectionTitle}>
            Safety Cues
          </Text>
          {machine.safety_cues.map((cue, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.warningIcon}>
                <Text variant="caption" color="white">
                  !
                </Text>
              </View>
              <Text variant="body" style={styles.bulletText}>
                {cue}
              </Text>
            </View>
          ))}
        </Card>
      )}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  gymName: {
    marginBottom: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  bulletText: {
    flex: 1,
  },
  warningIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  errorTitle: {
    marginBottom: spacing.sm,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    marginBottom: spacing.md,
  },
});
