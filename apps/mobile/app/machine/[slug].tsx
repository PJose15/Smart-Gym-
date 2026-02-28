import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import type { Machine, WorkoutStatus, AlternativeResult } from '@smartgym/types';
import { getMachineAlternatives } from '@smartgym/ai-assist';
import { Button, Text, Card } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { trackEvent } from '../../src/lib/events';
import { isFeatureEnabled, refreshFeatureFlags, needsRefresh } from '../../src/lib/featureFlags';
import { generateMachineMistakes, localCache } from '@smartgym/ai-assist';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MachineWithGym extends Machine {
  gym_name: string;
  common_mistakes: string[];
  cue_version: number;
  cue_source: string;
}

const GYM_MACHINES_CACHE_KEY = '@smartgym:gym_machines';
const GYM_MACHINES_CACHE_VERSION_KEY = '@smartgym:gym_machines_version';

export default function MachineDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<MachineWithGym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [commonMistakes, setCommonMistakes] = useState<string[]>([]);

  // Alternatives state
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeResult[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const handleStartWorkout = async () => {
    if (!machine) return;
    setStartingWorkout(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to start a workout.');
        setStartingWorkout(false);
        return;
      }
      const status: WorkoutStatus = 'in_progress';
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({ gym_id: machine.gym_id, profile_id: user.id, status })
        .select()
        .single();
      if (wErr || !workout) throw wErr || new Error('Failed to create workout');

      await supabase.from('workout_exercises').insert({
        workout_id: workout.id,
        machine_id: machine.id,
        exercise_name: machine.name,
        order_index: 0,
      });

      router.push(`/workout/${workout.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start workout');
    } finally {
      setStartingWorkout(false);
    }
  };

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

  // Refresh feature flags if stale, then track machine_viewed event
  // and resolve common mistakes (from RPC data or generated defaults).
  useEffect(() => {
    if (!machine) return;

    trackEvent('machine_viewed', { machine_id: machine.id, slug });

    (async () => {
      // Ensure feature flags are fresh
      if (needsRefresh()) {
        await refreshFeatureFlags();
      }

      // Resolve common mistakes: use RPC data if present, otherwise generate defaults
      const rpcMistakes = machine.common_mistakes ?? [];
      if (rpcMistakes.length > 0) {
        setCommonMistakes(rpcMistakes);
      } else {
        const generated = await generateMachineMistakes({
          machineName: machine.name,
          targetMuscles: machine.target_muscles,
          setupSteps: machine.setup_steps,
        });
        setCommonMistakes(generated);
      }

      // Track AI cues viewed if the feature is enabled
      if (isFeatureEnabled('ai_assist')) {
        trackEvent('ai_cues_viewed', { machine_id: machine.id });
      }
    })();
  }, [machine]);

  // ─── Alternatives Logic ────────────────────────────────

  async function fetchGymMachines(gymId: string): Promise<Machine[]> {
    // Check in-memory cache first
    const cacheKey = `gym-machines:${gymId}`;
    const cached = localCache.get<Machine[]>(cacheKey);
    if (cached) return cached;

    // Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(`${GYM_MACHINES_CACHE_KEY}:${gymId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Machine[];
        localCache.set(cacheKey, parsed, 10 * 60 * 1000); // 10 min in-memory
        return parsed;
      }
    } catch { /* ignore */ }

    // Fetch from Supabase
    const { data, error: fetchErr } = await supabase
      .from('machines')
      .select('id, name, gym_id, qr_slug, target_muscles, setup_steps, safety_cues, image_url, common_mistakes, cue_version, cue_source, movement_pattern, equipment_type, difficulty, primary_muscles, secondary_muscles, tags, form_checklist_before, form_checklist_during, form_checklist_after, checklist_version, created_at')
      .eq('gym_id', gymId);

    if (fetchErr || !data) return [];

    const machines = data as unknown as Machine[];

    // Cache
    localCache.set(cacheKey, machines, 10 * 60 * 1000);
    try {
      await AsyncStorage.setItem(`${GYM_MACHINES_CACHE_KEY}:${gymId}`, JSON.stringify(machines));
    } catch { /* ignore */ }

    return machines;
  }

  async function handleFindAlternatives() {
    if (!machine) return;
    setLoadingAlternatives(true);
    setShowAlternatives(true);

    try {
      const gymMachines = await fetchGymMachines(machine.gym_id);

      // Get training profile for experience level
      const { data: { user } } = await supabase.auth.getUser();
      let experience: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
      if (user) {
        const { data: tp } = await supabase
          .from('user_training_profiles')
          .select('experience')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (tp?.experience) {
          experience = tp.experience as typeof experience;
        }
      }

      const results = getMachineAlternatives({
        machine,
        machinesInGym: gymMachines,
        experience,
      });

      setAlternatives(results);
      trackEvent('alternatives_viewed', { machine_id: machine.id, count: results.length });
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlternatives(false);
    }
  }

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
    <AnimatedScreen>
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

      {commonMistakes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Mistakes</Text>
          {commonMistakes.map((mistake, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.mistakeIcon}>!</Text>
              <Text style={styles.bulletText}>{mistake}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Machine Busy? — Alternatives Button */}
      {isFeatureEnabled('ai_machine_alternatives') && (
        <TouchableOpacity
          style={styles.alternativesButton}
          onPress={handleFindAlternatives}
        >
          <Text style={styles.alternativesButtonText}>
            Machine busy? Find alternatives
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.startWorkoutButton, startingWorkout && { opacity: 0.6 }]}
        onPress={handleStartWorkout}
        disabled={startingWorkout}
      >
        <Text style={styles.startWorkoutText}>
          {startingWorkout ? 'Starting...' : 'Start Workout with This Machine'}
        </Text>
      </TouchableOpacity>
    </ScrollView>

    {/* ─── Alternatives Modal ─────────────────────────── */}
    <Modal
      visible={showAlternatives}
      animationType="slide"
      transparent
      onRequestClose={() => setShowAlternatives(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Alternative Machines</Text>
            <TouchableOpacity onPress={() => setShowAlternatives(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          {loadingAlternatives ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : alternatives.length === 0 ? (
            <View style={styles.emptyAlternatives}>
              <Text style={styles.emptyAlternativesText}>
                No similar machines found in this gym. Try asking a trainer for exercise swaps.
              </Text>
            </View>
          ) : (
            <FlatList
              data={alternatives}
              keyExtractor={(item) => item.machine.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.alternativeCard}
                  onPress={() => {
                    setShowAlternatives(false);
                    router.push(`/machine/${item.machine.qr_slug}`);
                  }}
                >
                  <Text style={styles.alternativeName}>{item.machine.name}</Text>
                  <View style={styles.alternativeReasons}>
                    {item.reasons.filter((r) => r !== 'Higher difficulty').map((reason, i) => (
                      <View key={i} style={styles.reasonChip}>
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                  {item.machine.primary_muscles.length > 0 && (
                    <View style={styles.alternativeMuscles}>
                      {item.machine.primary_muscles.slice(0, 3).map((m) => (
                        <Text key={m} style={styles.alternativeMuscleText}>{m}</Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.alternativeAction}>Open</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
    </AnimatedScreen>
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
  mistakeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.warning,
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
  startWorkoutButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  startWorkoutText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  // Alternatives button
  alternativesButton: {
    backgroundColor: '#edf2ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#c5cae9',
  },
  alternativesButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyAlternatives: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyAlternativesText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Alternative card
  alternativeCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alternativeName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  alternativeReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.xs,
  },
  reasonChip: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  alternativeMuscles: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xs,
  },
  alternativeMuscleText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  alternativeAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
});
