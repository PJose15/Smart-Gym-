import { useEffect, useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { supabase } from '../../src/lib/supabase';
import type { Machine, WorkoutStatus, AlternativeResult } from '@nexera/types';
import { getMachineAlternatives } from '@nexera/ai-assist';
import { Button, Text, Card } from '../../src/components';
import { AnimatedScreen } from '../../src/components/AnimatedScreen';
import { SkeletonGate, MachineDetailSkeleton } from '../../src/components/skeleton';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { trackEvent } from '../../src/lib/events';
import { isFeatureEnabled, refreshFeatureFlags, needsRefresh } from '../../src/lib/featureFlags';
import { generateMachineMistakes, localCache } from '@nexera/ai-assist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectWorkoutMode } from '../../src/lib/workoutMode';
import type { ModeContext } from '../../src/lib/workoutMode';

interface MachineWithGym extends Machine {
  gym_name: string;
  common_mistakes: string[];
  cue_version: number;
  cue_source: string;
  maintenance_status?: string;
}

// ─── Enrichment Types ─────────────────────────────────
interface MachineHistory {
  totalSessions: number;
  lastUsed: string | null;
  bestWeightKg: number;
  bestReps: number;
  bestEst1RM: number;
  totalVolumeKg: number;
  recentSets: Array<{ weight_kg: number; reps: number; logged_at: string }>;
}

// ─── Difficulty labels ────────────────────────────────
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: colors.success },
  intermediate: { label: 'Intermediate', color: colors.gold },
  advanced: { label: 'Advanced', color: colors.error },
};

const EQUIPMENT_LABELS: Record<string, string> = {
  machine: 'Machine',
  cable: 'Cable',
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  bodyweight: 'Bodyweight',
  smith: 'Smith Machine',
  cardio: 'Cardio',
};

const MOVEMENT_LABELS: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  squat: 'Squat',
  hinge: 'Hinge',
  carry: 'Carry',
  core: 'Core',
  isolation: 'Isolation',
};

const GYM_MACHINES_CACHE_KEY = '@nexera:gym_machines';
const GYM_MACHINES_CACHE_VERSION_KEY = '@nexera:gym_machines_version';

export default function MachineDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [machine, setMachine] = useState<MachineWithGym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [commonMistakes, setCommonMistakes] = useState<string[]>([]);
  const [imageError, setImageError] = useState(false);

  // Alternatives state
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeResult[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // Enrichment state
  const [history, setHistory] = useState<MachineHistory | null>(null);

  // Workout mode context
  const [modeContext, setModeContext] = useState<ModeContext | null>(null);

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
      if (err instanceof Error && err.name === 'AbortError') {
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
          targetMuscles: machine.muscle_groups,
          setupSteps: machine.setup_steps,
        });
        setCommonMistakes(generated);
      }

      // Track AI cues viewed if the feature is enabled
      if (isFeatureEnabled('ai_assist')) {
        trackEvent('ai_cues_viewed', { machine_id: machine.id });
      }

      // Load personal history for this machine
      await loadMachineHistory(machine.id);

      // Load workout mode context
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const ctx = await detectWorkoutMode(user.id);
          setModeContext(ctx);
        }
      } catch (err) {
        console.warn('[machine] mode detection failed:', err);
      }
    })();
  }, [machine]);

  async function loadMachineHistory(machineId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all workout exercises for this machine by this user
      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select(`
          id,
          workouts!inner(profile_id, started_at, status),
          sets(weight_kg, reps, logged_at)
        `)
        .eq('machine_id', machineId)
        .eq('workouts.profile_id', user.id)
        .eq('workouts.status', 'completed')
        .order('workouts(started_at)', { ascending: false })
        .limit(50);

      if (!exercises || exercises.length === 0) {
        setHistory(null);
        return;
      }

      const rows = exercises as any[];
      let bestWeightKg = 0;
      let bestReps = 0;
      let bestEst1RM = 0;
      let totalVolumeKg = 0;
      const recentSets: MachineHistory['recentSets'] = [];

      for (const ex of rows) {
        for (const s of (ex.sets ?? [])) {
          const w = s.weight_kg ?? 0;
          const r = s.reps ?? 0;
          totalVolumeKg += w * r;
          if (w > bestWeightKg) bestWeightKg = w;
          if (r > bestReps) bestReps = r;
          // Brzycki 1RM estimate
          if (r > 0 && r <= 12 && w > 0) {
            const est = w * (36 / (37 - r));
            if (est > bestEst1RM) bestEst1RM = est;
          }
          if (recentSets.length < 5) {
            recentSets.push({ weight_kg: w, reps: r, logged_at: s.logged_at });
          }
        }
      }

      // Unique sessions = unique workout dates
      const sessionDates = new Set(rows.map((e: any) => e.workouts?.started_at?.split('T')[0]).filter(Boolean));

      setHistory({
        totalSessions: sessionDates.size,
        lastUsed: rows[0]?.workouts?.started_at ?? null,
        bestWeightKg,
        bestReps,
        bestEst1RM: Math.round(bestEst1RM * 10) / 10,
        totalVolumeKg: Math.round(totalVolumeKg),
        recentSets,
      });
    } catch (err) {
      console.warn('[machine] history load failed:', err);
    }
  }

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
    } catch (err) { console.warn('[machine] cache read failed:', err); }

    // Fetch from Supabase
    const { data, error: fetchErr } = await supabase
      .from('machines')
      .select('id, name, gym_id, qr_slug, muscle_groups, setup_steps, safety_cues, image_url, common_mistakes, cue_version, cue_source, movement_pattern, equipment_type, difficulty, secondary_muscles, tags, form_checklist_before, form_checklist_during, form_checklist_after, checklist_version, created_at')
      .eq('gym_id', gymId);

    if (fetchErr || !data) return [];

    const machines = data as unknown as Machine[];

    // Cache
    localCache.set(cacheKey, machines, 10 * 60 * 1000);
    try {
      await AsyncStorage.setItem(`${GYM_MACHINES_CACHE_KEY}:${gymId}`, JSON.stringify(machines));
    } catch (err) { console.warn('[machine] cache write failed:', err); }

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

  function formatTimeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
  }

  if (loading) {
    return <SkeletonGate loading={true} skeleton={<MachineDetailSkeleton />}><View /></SkeletonGate>;
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
      {machine.image_url && !imageError && (
        <Image
          source={{ uri: machine.image_url }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      )}

      <Text variant="heading">{machine.name}</Text>
      {machine.gym_name && (
        <Text variant="caption" style={styles.gymName}>
          {machine.gym_name}
        </Text>
      )}

      {/* ─── Workout Mode Context ──────────────── */}
      {modeContext && modeContext.mode !== 'freestyle' && (
        <View style={styles.modeSection}>
          <View style={[
            styles.modePill,
            { backgroundColor: modeContext.mode === 'trainer-program' ? colors.purpleSubtle : colors.primarySubtle },
          ]}>
            <Text style={[
              styles.modePillText,
              { color: modeContext.mode === 'trainer-program' ? colors.purple : colors.primary },
            ]}>
              {modeContext.mode === 'trainer-program'
                ? `Coach Plan${modeContext.trainerName ? ` · ${modeContext.trainerName}` : ''}`
                : 'AI Plan'}
            </Text>
          </View>

          {modeContext.todayDay && (() => {
            const isInPlan = modeContext.todayDay.exercises.some(
              (e) => e.machine_id === machine.id,
            );
            const planExercise = modeContext.todayDay.exercises.find(
              (e) => e.machine_id === machine.id,
            );

            if (isInPlan && planExercise) {
              return (
                <Card style={styles.modeCard}>
                  <Text variant="caption" style={styles.modeCardLabel}>
                    {'✓ Today\'s target'}
                  </Text>
                  <Text variant="body" style={styles.modeCardText}>
                    {planExercise.default_sets} sets x {planExercise.default_reps} reps
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    This machine is in today's plan ({modeContext.todayDay.dayName})
                  </Text>
                </Card>
              );
            }

            // Machine not in today's plan
            const otherMachineExercises = modeContext.todayDay.exercises.filter(
              (e) => e.machine_id && e.machine_id !== machine.id,
            );
            return (
              <View>
                <Text variant="caption" color="textSecondary" style={styles.modeNote}>
                  Not in today's plan — no worries, we'll track it
                </Text>
                {otherMachineExercises.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeSuggestions}>
                    {otherMachineExercises.slice(0, 5).map((e) => (
                      <View key={e.id} style={styles.modeSuggestionChip}>
                        <Text style={styles.modeSuggestionText} numberOfLines={1}>
                          {e.exercise_name}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            );
          })()}
        </View>
      )}

      {modeContext && modeContext.mode === 'freestyle' && (
        <View style={styles.modeSection}>
          <View style={[styles.modePill, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modePillText, { color: colors.textSecondary }]}>Freestyle</Text>
          </View>
        </View>
      )}

      {machine.muscle_groups.length > 0 && (
        <View style={styles.chipsContainer}>
          {machine.muscle_groups.map((muscle, i: number) => (
            <View key={i} style={styles.chip}>
              <Text variant="caption" color="white">
                {muscle}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Machine Metadata Badges ──────────────── */}
      {(machine.difficulty || machine.equipment_type || machine.movement_pattern) && (
        <View style={styles.metadataRow}>
          {machine.difficulty && DIFFICULTY_CONFIG[machine.difficulty] && (
            <View style={[styles.metaBadge, { backgroundColor: DIFFICULTY_CONFIG[machine.difficulty].color + '18' }]}>
              <Text style={[styles.metaBadgeText, { color: DIFFICULTY_CONFIG[machine.difficulty].color }]}>
                {DIFFICULTY_CONFIG[machine.difficulty].label}
              </Text>
            </View>
          )}
          {machine.equipment_type && EQUIPMENT_LABELS[machine.equipment_type] && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>
                {EQUIPMENT_LABELS[machine.equipment_type]}
              </Text>
            </View>
          )}
          {machine.movement_pattern && MOVEMENT_LABELS[machine.movement_pattern] && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>
                {MOVEMENT_LABELS[machine.movement_pattern]}
              </Text>
            </View>
          )}
          {machine.maintenance_status === 'in_maintenance' && (
            <View style={[styles.metaBadge, { backgroundColor: colors.error + '18' }]}>
              <Text style={[styles.metaBadgeText, { color: colors.error }]}>
                In Maintenance
              </Text>
            </View>
          )}
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

      {/* ─── Personal History on This Machine ──── */}
      {history && (
        <AnimatedCard index={0} style={styles.historyCard}>
          <Text variant="subheading" style={styles.historySectionTitle}>
            Your History
          </Text>
          <View style={styles.historyGrid}>
            <View style={styles.historyPill}>
              <Text style={styles.historyValue}>{history.totalSessions}</Text>
              <Text variant="caption" color="textSecondary">sessions</Text>
            </View>
            <View style={styles.historyPill}>
              <Text style={styles.historyValue}>{history.bestWeightKg}kg</Text>
              <Text variant="caption" color="textSecondary">best weight</Text>
            </View>
            <View style={styles.historyPill}>
              <Text style={styles.historyValue}>{history.bestReps}</Text>
              <Text variant="caption" color="textSecondary">best reps</Text>
            </View>
            {history.bestEst1RM > 0 && (
              <View style={styles.historyPill}>
                <Text style={styles.historyValue}>{history.bestEst1RM}kg</Text>
                <Text variant="caption" color="textSecondary">est. 1RM</Text>
              </View>
            )}
          </View>
          {history.lastUsed && (
            <Text variant="caption" color="textSecondary" style={styles.historyLastUsed}>
              Last used {formatTimeSince(history.lastUsed)}
              {'  '}|{'  '}{history.totalVolumeKg.toLocaleString()}kg total volume
            </Text>
          )}
          {history.recentSets.length > 0 && (
            <View style={styles.recentSetsContainer}>
              <Text variant="caption" color="textSecondary" style={styles.recentSetsLabel}>
                Recent sets
              </Text>
              <View style={styles.recentSetsRow}>
                {history.recentSets.map((s, i) => (
                  <View key={i} style={styles.recentSetChip}>
                    <Text style={styles.recentSetText}>
                      {s.weight_kg}kg x {s.reps}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </AnimatedCard>
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
      {Platform.OS === 'ios' ? (
        <BlurView tint="dark" intensity={40} style={styles.modalOverlay}>
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
                    {item.machine.muscle_groups.length > 0 && (
                      <View style={styles.alternativeMuscles}>
                        {item.machine.muscle_groups.slice(0, 3).map((m) => (
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
        </BlurView>
      ) : (
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
                  {item.machine.muscle_groups.length > 0 && (
                    <View style={styles.alternativeMuscles}>
                      {item.machine.muscle_groups.slice(0, 3).map((m) => (
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
      )}
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

  // Metadata badges
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  metaBadge: {
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Personal history card
  historyCard: {
    marginBottom: spacing.lg,
  },
  historySectionTitle: {
    marginBottom: spacing.sm,
  },
  historyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyPill: {
    alignItems: 'center',
    flex: 1,
  },
  historyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  historyLastUsed: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  recentSetsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  recentSetsLabel: {
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  recentSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recentSetChip: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recentSetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },

  // Alternatives button
  // Workout mode context styles
  modeSection: {
    marginBottom: spacing.md,
  },
  modePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modeCard: {
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  modeCardLabel: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  modeCardText: {
    fontWeight: '600',
    marginBottom: 4,
  },
  modeNote: {
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  modeSuggestions: {
    marginBottom: spacing.xs,
  },
  modeSuggestionChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: spacing.xs,
  },
  modeSuggestionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    maxWidth: 120,
  },

  alternativesButton: {
    backgroundColor: colors.primarySubtle,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  alternativesButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    color: colors.text,
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
    color: colors.text,
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
