import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import type { Machine } from '@smartgym/types';
import type { WorkoutStatus } from '@smartgym/types';
import { trackEvent } from '../../src/lib/events';
import { isFeatureEnabled, refreshFeatureFlags, needsRefresh } from '../../src/lib/featureFlags';
import { generateMachineMistakes } from '@smartgym/ai-assist';

interface MachineWithGym extends Machine {
  gym_name: string;
  common_mistakes: string[];
  cue_version: number;
  cue_source: string;
}

export default function MachineDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<MachineWithGym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [commonMistakes, setCommonMistakes] = useState<string[]>([]);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Loading machine...</Text>
      </View>
    );
  }

  if (error || !machine) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Machine Not Found</Text>
        <Text style={styles.errorText}>{error || 'This QR code does not match any machine.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchMachine}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {machine.image_url && (
        <Image source={{ uri: machine.image_url }} style={styles.image} resizeMode="cover" />
      )}

      <Text style={styles.name}>{machine.name}</Text>
      {machine.gym_name && (
        <Text style={styles.gymName}>{machine.gym_name}</Text>
      )}

      {machine.target_muscles.length > 0 && (
        <View style={styles.chipsContainer}>
          {machine.target_muscles.map((muscle, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{muscle}</Text>
            </View>
          ))}
        </View>
      )}

      {machine.setup_steps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Setup Instructions</Text>
          {machine.setup_steps.map((step, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletNumber}>{i + 1}</Text>
              <Text style={styles.bulletText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {machine.safety_cues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Cues</Text>
          {machine.safety_cues.map((cue, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.warningIcon}>!</Text>
              <Text style={styles.bulletText}>{cue}</Text>
            </View>
          ))}
        </View>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  image: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  name: { fontSize: 28, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  gymName: { fontSize: 14, color: '#6c757d', marginBottom: 12 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { backgroundColor: '#4361ee', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingRight: 16 },
  bulletNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4361ee', color: '#fff', textAlign: 'center', lineHeight: 24, fontSize: 13, fontWeight: '600', marginRight: 10 },
  bulletText: { flex: 1, fontSize: 15, color: '#212529', lineHeight: 22 },
  warningIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e63946', color: '#fff', textAlign: 'center', lineHeight: 20, fontSize: 13, fontWeight: '700', marginRight: 10, marginTop: 1 },
  mistakeIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#f4a261', color: '#fff', textAlign: 'center', lineHeight: 20, fontSize: 13, fontWeight: '700', marginRight: 10, marginTop: 1 },
  loadingText: { fontSize: 16, color: '#6c757d', marginTop: 12 },
  errorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e63946', color: '#fff', textAlign: 'center', lineHeight: 48, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  errorText: { fontSize: 16, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#4361ee', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginBottom: 12 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: { paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { color: '#4361ee', fontSize: 16, fontWeight: '600' },
  startWorkoutButton: { backgroundColor: '#2a9d8f', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  startWorkoutText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
