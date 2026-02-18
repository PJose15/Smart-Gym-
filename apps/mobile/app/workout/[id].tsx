import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import type {
  Workout,
  WorkoutExerciseWithSets,
  WorkoutSet,
  Machine,
} from '@smartgym/types';
import { getNextSetSuggestion } from '@smartgym/ai-assist';
import type { NextSetSuggestion, WeightUnit } from '@smartgym/types';
import { isFeatureEnabled, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { trackEvent } from '../../src/lib/events';
import { logAiDecision } from '../../src/lib/aiAudit';
import { getWeightUnit } from '../../src/lib/weightUnit';

// ─── Helpers ────────────────────────────────────────────

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.4) return 'Medium';
  return 'Low';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.75) return '#2a9d8f';
  if (confidence >= 0.4) return '#e9c46a';
  return '#adb5bd';
}

// ─── Sub-components ─────────────────────────────────────

interface SetRowProps {
  set: WorkoutSet;
}

function SetRow({ set }: SetRowProps) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>#{set.set_number}</Text>
      <Text style={styles.setValue}>{set.weight_kg} kg</Text>
      <Text style={styles.setValue}>
        {set.reps} rep{set.reps !== 1 ? 's' : ''}
      </Text>
      {set.rpe != null && (
        <Text style={styles.setRpe}>RPE {set.rpe}</Text>
      )}
    </View>
  );
}

// ─── Suggestion Card ────────────────────────────────────

interface SuggestionCardProps {
  suggestion: NextSetSuggestion | null;
  onApply: () => void;
}

function SuggestionCard({ suggestion, onApply }: SuggestionCardProps) {
  if (!suggestion) return null;

  const confidenceLabel = getConfidenceLabel(suggestion.confidence);
  const confidenceColor = getConfidenceColor(suggestion.confidence);

  return (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionTitle}>Suggested next set</Text>
        <View
          style={[
            styles.confidenceBadge,
            { backgroundColor: confidenceColor },
          ]}
        >
          <Text style={styles.confidenceBadgeText}>{confidenceLabel}</Text>
        </View>
      </View>

      <Text style={styles.suggestionValues}>
        {suggestion.suggested_weight} kg x {suggestion.suggested_reps} reps
      </Text>

      <Text style={styles.suggestionReason}>
        Why: {suggestion.reason_text}
      </Text>

      {suggestion.safety_note ? (
        <Text style={styles.suggestionSafetyNote}>
          {suggestion.safety_note}
        </Text>
      ) : null}

      <TouchableOpacity style={styles.suggestionApplyButton} onPress={onApply}>
        <Text style={styles.suggestionApplyButtonText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Set Form ───────────────────────────────────────

interface AddSetFormProps {
  lastWeight: number;
  onLogSet: (weight: number, reps: number, rpe: number | undefined) => void;
  isLogging: boolean;
  prefillWeight?: number | null;
  prefillReps?: number | null;
}

function AddSetForm({
  lastWeight,
  onLogSet,
  isLogging,
  prefillWeight,
  prefillReps,
}: AddSetFormProps) {
  const [weight, setWeight] = useState(lastWeight.toString());
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');

  // Keep weight in sync when lastWeight changes (e.g. after a set is logged)
  useEffect(() => {
    setWeight(lastWeight.toString());
  }, [lastWeight]);

  // Apply prefilled values from AI suggestion
  useEffect(() => {
    if (prefillWeight != null) {
      setWeight(prefillWeight.toString());
    }
  }, [prefillWeight]);

  useEffect(() => {
    if (prefillReps != null) {
      setReps(prefillReps.toString());
    }
  }, [prefillReps]);

  const handleLog = () => {
    const weightNum = weight === '' ? 0 : parseFloat(weight);
    const repsNum = parseInt(reps, 10);
    const rpeNum = rpe !== '' ? parseInt(rpe, 10) : undefined;

    // Validation
    if (isNaN(repsNum) || repsNum <= 0) {
      Alert.alert('Invalid reps', 'Reps must be a positive number.');
      return;
    }
    if (repsNum > 999) {
      Alert.alert('Invalid reps', 'Reps cannot exceed 999.');
      return;
    }
    if (isNaN(weightNum) || weightNum < 0) {
      Alert.alert('Invalid weight', 'Weight must be 0 or greater.');
      return;
    }
    if (weightNum > 9999) {
      Alert.alert('Invalid weight', 'Weight cannot exceed 9999 kg.');
      return;
    }
    if (rpeNum !== undefined && (rpeNum < 1 || rpeNum > 10 || isNaN(rpeNum))) {
      Alert.alert('Invalid RPE', 'RPE must be between 1 and 10.');
      return;
    }

    onLogSet(weightNum, repsNum, rpeNum);
    setReps('');
    setRpe('');
  };

  return (
    <View style={styles.addSetRow}>
      <TextInput
        style={styles.addSetInput}
        placeholder="kg"
        placeholderTextColor="#adb5bd"
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />
      <TextInput
        style={styles.addSetInput}
        placeholder="reps"
        placeholderTextColor="#adb5bd"
        keyboardType="numeric"
        value={reps}
        onChangeText={setReps}
      />
      <TextInput
        style={[styles.addSetInput, styles.addSetInputSmall]}
        placeholder="RPE"
        placeholderTextColor="#adb5bd"
        keyboardType="numeric"
        value={rpe}
        onChangeText={setRpe}
        maxLength={2}
      />
      <TouchableOpacity
        style={[styles.logSetButton, isLogging && styles.logSetButtonDisabled]}
        onPress={handleLog}
        disabled={isLogging}
      >
        {isLogging ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.logSetButtonText}>Log</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise Card ──────────────────────────────────────

interface ExerciseCardProps {
  exercise: WorkoutExerciseWithSets;
  onLogSet: (
    exerciseId: string,
    weight: number,
    reps: number,
    rpe: number | undefined,
  ) => void;
  loggingExerciseId: string | null;
  suggestion: NextSetSuggestion | null;
  onApplySuggestion: (exerciseId: string) => void;
  aiEnabled: boolean;
}

function ExerciseCard({
  exercise,
  onLogSet,
  loggingExerciseId,
  suggestion,
  onApplySuggestion,
  aiEnabled,
}: ExerciseCardProps) {
  const sortedSets = [...exercise.sets].sort((a, b) => a.set_number - b.set_number);
  const lastSet = sortedSets[sortedSets.length - 1];
  const lastWeight = lastSet ? lastSet.weight_kg : 0;

  const [prefillWeight, setPrefillWeight] = useState<number | null>(null);
  const [prefillReps, setPrefillReps] = useState<number | null>(null);

  const handleApply = () => {
    if (suggestion) {
      setPrefillWeight(suggestion.suggested_weight);
      setPrefillReps(suggestion.suggested_reps);
    }
    onApplySuggestion(exercise.id);
  };

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
        {exercise.machine && (
          <Text style={styles.machineName}>{exercise.machine.name}</Text>
        )}
      </View>

      {sortedSets.length > 0 && (
        <View style={styles.setsContainer}>
          <View style={styles.setHeaderRow}>
            <Text style={styles.setHeaderText}>Set</Text>
            <Text style={styles.setHeaderText}>Weight</Text>
            <Text style={styles.setHeaderText}>Reps</Text>
            <Text style={styles.setHeaderText}>RPE</Text>
          </View>
          {sortedSets.map((set) => (
            <SetRow key={set.id} set={set} />
          ))}
        </View>
      )}

      {sortedSets.length === 0 && (
        <Text style={styles.noSetsText}>No sets logged yet</Text>
      )}

      {aiEnabled && (
        <SuggestionCard suggestion={suggestion} onApply={handleApply} />
      )}

      <View style={styles.addSetSection}>
        <Text style={styles.addSetLabel}>Add Set</Text>
        <AddSetForm
          lastWeight={lastWeight}
          onLogSet={(weight, reps, rpe) => onLogSet(exercise.id, weight, reps, rpe)}
          isLogging={loggingExerciseId === exercise.id}
          prefillWeight={prefillWeight}
          prefillReps={prefillReps}
        />
      </View>
    </View>
  );
}

// ─── Add Exercise Modal ─────────────────────────────────

interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, machineId: string | undefined) => void;
  machines: Array<{ id: string; name: string }>;
  isAdding: boolean;
}

function AddExerciseModal({
  visible,
  onClose,
  onAdd,
  machines,
  isAdding,
}: AddExerciseModalProps) {
  const [name, setName] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>(
    undefined,
  );

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter an exercise name.');
      return;
    }
    onAdd(trimmed, selectedMachineId);
    setName('');
    setSelectedMachineId(undefined);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Exercise</Text>

            <Text style={styles.modalLabel}>Exercise Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Bench Press"
              placeholderTextColor="#adb5bd"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={styles.modalLabel}>Machine (optional)</Text>
            <FlatList
              data={machines}
              keyExtractor={(item) => item.id}
              style={styles.machineList}
              ListEmptyComponent={
                <Text style={styles.emptyMachineText}>No machines available</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.machineItem,
                    selectedMachineId === item.id && styles.machineItemSelected,
                  ]}
                  onPress={() =>
                    setSelectedMachineId(
                      selectedMachineId === item.id ? undefined : item.id,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.machineItemText,
                      selectedMachineId === item.id &&
                      styles.machineItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={onClose}
                disabled={isAdding}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  isAdding && styles.modalAddButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalAddText}>Add Exercise</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Rest Timer ──────────────────────────────────────────

const REST_DURATIONS = [60, 90, 120, 180]; // seconds

interface RestTimerProps {
  secondsLeft: number;
  isRunning: boolean;
  onDismiss: () => void;
  onSetDuration: (seconds: number) => void;
}

function RestTimer({ secondsLeft, isRunning, onDismiss, onSetDuration }: RestTimerProps) {
  if (!isRunning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${minutes}:${secs.toString().padStart(2, '0')}`;
  const isFinished = secondsLeft <= 0;

  return (
    <View style={styles.restTimerOverlay}>
      <View style={[styles.restTimerCard, isFinished && styles.restTimerCardDone]}>
        <Text style={styles.restTimerLabel}>
          {isFinished ? 'Rest Complete!' : 'Rest Timer'}
        </Text>
        <Text style={[styles.restTimerDisplay, isFinished && styles.restTimerDisplayDone]}>
          {isFinished ? '0:00' : display}
        </Text>
        <View style={styles.restTimerDurations}>
          {REST_DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={styles.restDurationChip}
              onPress={() => onSetDuration(d)}
            >
              <Text style={styles.restDurationChipText}>
                {d >= 60 ? `${d / 60}m` : `${d}s`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.restTimerDismiss} onPress={onDismiss}>
          <Text style={styles.restTimerDismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const { id: workoutId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExerciseWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingExerciseId, setLoggingExerciseId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Add exercise modal
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [machines, setMachines] = useState<Array<{ id: string; name: string }>>([]);
  const [addingExercise, setAddingExercise] = useState(false);

  // AI Assist state
  const [suggestions, setSuggestions] = useState<Record<string, NextSetSuggestion>>({});
  const [aiEnabled, setAiEnabled] = useState(false);
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg');

  // Rest timer state
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restDuration, setRestDuration] = useState(90); // default 90s
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ─── Initialize feature flags + weight unit ──────────
  useEffect(() => {
    const initFlags = async () => {
      try {
        await refreshFeatureFlags();
        setAiEnabled(isFeatureEnabled('ai_assist_enabled'));
        const unit = await getWeightUnit();
        setWeightUnitState(unit);
      } catch {
        // Feature flags failed to load; AI assist stays disabled
        setAiEnabled(false);
      }
    };
    initFlags();
  }, []);

  // ─── Rest timer logic ─────────────────────────────────
  useEffect(() => {
    if (restTimerRunning && restSecondsLeft > 0) {
      restIntervalRef.current = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev <= 1) {
            Vibration.vibrate(500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
    }
    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
      }
    };
  }, [restTimerRunning, restSecondsLeft]);

  const startRestTimer = useCallback(() => {
    setRestSecondsLeft(restDuration);
    setRestTimerRunning(true);
  }, [restDuration]);

  const dismissRestTimer = useCallback(() => {
    setRestTimerRunning(false);
    setRestSecondsLeft(0);
  }, []);

  const changeRestDuration = useCallback((seconds: number) => {
    setRestDuration(seconds);
    setRestSecondsLeft(seconds);
    setRestTimerRunning(true);
  }, []);

  // ─── Compute AI suggestion ────────────────────────────
  const computeSuggestion = useCallback(
    async (exerciseId: string) => {
      if (!aiEnabled || !workout) return;

      try {
        // Get the exercise's current sets from state
        const exercise = exercises.find((e) => e.id === exerciseId);
        if (!exercise) return;

        const currentSets = exercise.sets;

        // Fetch previous session sets for the same profile + machine
        let previousSets: WorkoutSet[] = [];
        if (exercise.machine_id) {
          const { data: prevWorkoutExercises } = await supabase
            .from('workout_exercises')
            .select('id, workout_id, sets(*), workouts!inner(profile_id, status, finished_at)')
            .eq('machine_id', exercise.machine_id)
            .neq('workout_id', workout.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (prevWorkoutExercises && prevWorkoutExercises.length > 0) {
            previousSets = (prevWorkoutExercises[0].sets ?? []) as WorkoutSet[];
          }
        }

        // Call the AI suggestion engine
        const result = await getNextSetSuggestion({ currentSets, previousSets, unit: weightUnit });

        // Update suggestions state
        setSuggestions((prev) => ({
          ...prev,
          [exerciseId]: result,
        }));

        // Track the event
        trackEvent('ai_next_set_shown', { exercise_id: exerciseId });

        // Audit log
        logAiDecision('next_set', { exerciseId, currentSets }, { ...result });
      } catch {
        // Don't block UX if AI suggestion fails
      }
    },
    [aiEnabled, exercises, workout],
  );

  // ─── Fetch data ─────────────────────────────────────
  const fetchWorkoutData = useCallback(async () => {
    if (!workoutId) {
      setError('No workout ID provided');
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);

    setLoading(true);
    setError(null);

    try {
      // Fetch workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .abortSignal(controller.signal)
        .single();

      if (workoutError) throw workoutError;
      if (!workoutData) throw new Error('Workout not found');

      setWorkout(workoutData as Workout);

      // Fetch exercises with sets
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*, sets(*)')
        .eq('workout_id', workoutId)
        .order('order_index')
        .abortSignal(controller.signal);

      if (exercisesError) throw exercisesError;

      setExercises((exercisesData ?? []) as WorkoutExerciseWithSets[]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load workout');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    fetchWorkoutData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchWorkoutData]);

  // ─── Fetch machines (when modal opens) ──────────────
  const fetchMachines = useCallback(async () => {
    if (!workout) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const { data, error: machineError } = await supabase
        .from('machines')
        .select('id, name')
        .eq('gym_id', workout.gym_id)
        .abortSignal(controller.signal);

      if (machineError) throw machineError;
      setMachines((data ?? []) as Array<{ id: string; name: string }>);
    } catch {
      // Silently fail -- machine picker is optional
      setMachines([]);
    } finally {
      clearTimeout(timeout);
    }
  }, [workout]);

  const handleOpenAddExercise = () => {
    fetchMachines();
    setShowAddExercise(true);
  };

  // ─── Log a set ──────────────────────────────────────
  const handleLogSet = async (
    exerciseId: string,
    weight: number,
    reps: number,
    rpe: number | undefined,
  ) => {
    setLoggingExerciseId(exerciseId);

    // Determine next set number
    const exercise = exercises.find((e) => e.id === exerciseId);
    const currentSets = exercise?.sets ?? [];
    const nextSetNumber =
      currentSets.length > 0
        ? Math.max(...currentSets.map((s) => s.set_number)) + 1
        : 1;

    const tempId = generateTempId();
    const now = new Date().toISOString();

    const optimisticSet: WorkoutSet = {
      id: tempId,
      workout_exercise_id: exerciseId,
      set_number: nextSetNumber,
      reps,
      weight_kg: weight,
      rpe: rpe ?? null,
      logged_at: now,
    };

    // Optimistic update
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: [...ex.sets, optimisticSet] }
          : ex,
      ),
    );

    try {
      const insertPayload: Record<string, unknown> = {
        workout_exercise_id: exerciseId,
        set_number: nextSetNumber,
        reps,
        weight_kg: weight,
        logged_at: now,
      };
      if (rpe !== undefined) {
        insertPayload.rpe = rpe;
      }

      const { data, error: insertError } = await supabase
        .from('sets')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Reconcile: replace temp set with server response
      const serverSet = data as WorkoutSet;
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId
            ? {
              ...ex,
              sets: ex.sets.map((s) => (s.id === tempId ? serverSet : s)),
            }
            : ex,
        ),
      );

      // Track set logged event
      trackEvent('set_logged', {
        exercise_id: exerciseId,
        set_number: nextSetNumber,
        weight_kg: weight,
        reps,
        rpe,
      });

      // Start rest timer
      startRestTimer();

      // Compute AI suggestion async (don't block the UI)
      if (aiEnabled) {
        computeSuggestion(exerciseId);
      }
    } catch (err: unknown) {
      // Rollback optimistic update
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId
            ? { ...ex, sets: ex.sets.filter((s) => s.id !== tempId) }
            : ex,
        ),
      );
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to log set. Please try again.',
      );
    } finally {
      setLoggingExerciseId(null);
    }
  };

  // ─── Handle apply suggestion ──────────────────────
  const handleApplySuggestion = (exerciseId: string) => {
    trackEvent('ai_next_set_applied', { exercise_id: exerciseId });
  };

  // ─── Add exercise ───────────────────────────────────
  const handleAddExercise = async (
    name: string,
    machineId: string | undefined,
  ) => {
    if (!workoutId) return;

    setAddingExercise(true);

    const nextOrderIndex =
      exercises.length > 0
        ? Math.max(...exercises.map((e) => e.order_index)) + 1
        : 0;

    try {
      const insertPayload: Record<string, unknown> = {
        workout_id: workoutId,
        exercise_name: name,
        order_index: nextOrderIndex,
      };
      if (machineId) {
        insertPayload.machine_id = machineId;
      }

      const { data, error: insertError } = await supabase
        .from('workout_exercises')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      const newExercise: WorkoutExerciseWithSets = {
        ...(data as WorkoutExerciseWithSets),
        sets: [],
      };

      // If a machine was selected, attach its name for display
      if (machineId) {
        const selectedMachine = machines.find((m) => m.id === machineId);
        if (selectedMachine) {
          newExercise.machine = { name: selectedMachine.name } as Machine;
        }
      }

      setExercises((prev) => [...prev, newExercise]);
      setShowAddExercise(false);
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to add exercise.',
      );
    } finally {
      setAddingExercise(false);
    }
  };

  // ─── Finish workout ─────────────────────────────────
  const handleFinishWorkout = () => {
    Alert.alert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', style: 'default', onPress: confirmFinishWorkout },
      ],
    );
  };

  const confirmFinishWorkout = async () => {
    if (!workoutId) return;
    setFinishing(true);

    try {
      const { error: updateError } = await supabase
        .from('workouts')
        .update({
          status: 'completed' as const,
          finished_at: new Date().toISOString(),
        })
        .eq('id', workoutId);

      if (updateError) throw updateError;

      // Track workout finished event
      trackEvent('workout_finished', {
        workout_id: workoutId,
        exercise_count: exercises.length,
        total_sets: exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
      });

      router.replace(`/workout/complete/${workoutId}`);
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to finish workout.',
      );
      setFinishing(false);
    }
  };

  // ─── Render: Loading ────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  // ─── Render: Error ──────────────────────────────────
  if (error || !workout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Could not load workout</Text>
        <Text style={styles.errorText}>
          {error || 'Workout not found.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWorkoutData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Active Workout ─────────────────────────
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Active Workout</Text>
        <Text style={styles.subtitle}>
          Started at{' '}
          {new Date(workout.started_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No exercises yet. Tap the + button to add one.
            </Text>
          </View>
        )}

        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onLogSet={handleLogSet}
            loggingExerciseId={loggingExerciseId}
            suggestion={suggestions[exercise.id] ?? null}
            onApplySuggestion={handleApplySuggestion}
            aiEnabled={aiEnabled}
          />
        ))}

        <TouchableOpacity
          style={[styles.finishButton, finishing && styles.finishButtonDisabled]}
          onPress={handleFinishWorkout}
          disabled={finishing}
        >
          {finishing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.finishButtonText}>Finish Workout</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Rest Timer */}
      <RestTimer
        secondsLeft={restSecondsLeft}
        isRunning={restTimerRunning}
        onDismiss={dismissRestTimer}
        onSetDuration={changeRestDuration}
      />

      {/* Floating Add Exercise Button */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenAddExercise}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Exercise Modal */}
      <AddExerciseModal
        visible={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        onAdd={handleAddExercise}
        machines={machines}
        isAdding={addingExercise}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 20,
  },

  // Loading / Error
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e63946',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 48,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    overflow: 'hidden',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#4361ee',
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
  },

  // Exercise Card
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  exerciseHeader: {
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
  },
  machineName: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },

  // Sets
  setsContainer: {
    marginBottom: 12,
  },
  setHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    marginBottom: 4,
  },
  setHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dee2e6',
  },
  setNumber: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#4361ee',
  },
  setValue: {
    flex: 1,
    fontSize: 14,
    color: '#212529',
  },
  setRpe: {
    flex: 1,
    fontSize: 14,
    color: '#6c757d',
  },
  noSetsText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 12,
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: '#f0f0ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d0ff',
    padding: 14,
    marginBottom: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  suggestionValues: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 6,
  },
  suggestionReason: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 4,
  },
  suggestionSafetyNote: {
    fontSize: 13,
    color: '#e63946',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  suggestionApplyButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  suggestionApplyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Add Set
  addSetSection: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 12,
  },
  addSetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addSetInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#f8f9fa',
  },
  addSetInputSmall: {
    flex: 0.7,
  },
  logSetButton: {
    backgroundColor: '#4361ee',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logSetButtonDisabled: {
    backgroundColor: '#a0b0ee',
  },
  logSetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Finish Button
  finishButton: {
    backgroundColor: '#2a9d8f',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  finishButtonDisabled: {
    backgroundColor: '#8ecfc7',
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Rest Timer
  restTimerOverlay: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
  },
  restTimerCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  restTimerCardDone: {
    backgroundColor: '#2a9d8f',
  },
  restTimerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  restTimerDisplay: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  restTimerDisplayDone: {
    color: '#ffffff',
  },
  restTimerDurations: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  restDurationChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  restDurationChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  restTimerDismiss: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  restTimerDismissText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3a0ca3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 30,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
  },
  machineList: {
    maxHeight: 180,
    marginBottom: 20,
  },
  machineItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 8,
  },
  machineItemSelected: {
    backgroundColor: '#4361ee',
    borderColor: '#4361ee',
  },
  machineItemText: {
    fontSize: 15,
    color: '#212529',
  },
  machineItemTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyMachineText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#4361ee',
  },
  modalAddButtonDisabled: {
    backgroundColor: '#a0b0ee',
  },
  modalAddText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
