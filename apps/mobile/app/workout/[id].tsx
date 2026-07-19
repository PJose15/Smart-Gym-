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
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../src/lib/supabase';
import type {
  Workout,
  WorkoutExerciseWithSets,
  WorkoutSet,
  Machine,
} from '@nexera/types';
import { getNextSetSuggestion, getFormChecklist, getSafetyNudge } from '@nexera/ai-assist';
import type { SafetyNudge } from '@nexera/ai-assist';
import type { SessionIntent } from '@nexera/types';
import type { NextSetSuggestion, WeightUnit, FormChecklist, SetFeedbackRating, BodyArea } from '@nexera/types';
import { isFeatureEnabled, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { trackEvent } from '../../src/lib/events';
import { logAiDecision } from '../../src/lib/aiAudit';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { retryWithBackoff } from '../../src/lib/retry';
import { enqueueEvent } from '../../src/lib/offlineQueue';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

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
  if (confidence >= 0.75) return colors.success;
  if (confidence >= 0.4) return colors.gold;
  return colors.textDisabled;
}

// ─── Session intent config ─────────────────────────────

const INTENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  light: { label: 'Light', color: colors.success, emoji: '\uD83C\uDF3F' },
  maintain: { label: 'Maintain', color: colors.gold, emoji: '\u2696\uFE0F' },
  push: { label: 'Push', color: colors.error, emoji: '\uD83D\uDD25' },
};

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
    <View style={styles.addSetContainer}>
      <View style={styles.addSetRow}>
        <View style={styles.addSetField}>
          <Text style={styles.addSetFieldLabel}>Weight (kg)</Text>
          <TextInput
            style={styles.addSetInput}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
        </View>
        <View style={styles.addSetField}>
          <Text style={styles.addSetFieldLabel}>Reps</Text>
          <TextInput
            style={styles.addSetInput}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={reps}
            onChangeText={setReps}
          />
        </View>
        <View style={[styles.addSetField, styles.addSetFieldSmall]}>
          <Text style={styles.addSetFieldLabel}>RPE</Text>
          <TextInput
            style={styles.addSetInput}
            placeholder="–"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={rpe}
            onChangeText={setRpe}
            maxLength={2}
          />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.logSetButton, isLogging && styles.logSetButtonDisabled]}
        onPress={handleLog}
        disabled={isLogging}
        activeOpacity={0.85}
      >
        {isLogging ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.logSetButtonText}>LOG SET {'✓'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Form Checklist Card ────────────────────────────────

interface ChecklistCardProps {
  checklist: FormChecklist;
}

function ChecklistCard({ checklist }: ChecklistCardProps) {
  const [activeTab, setActiveTab] = useState<'before' | 'during' | 'after'>('before');

  const items = activeTab === 'before' ? checklist.before
    : activeTab === 'during' ? checklist.during
    : checklist.after;

  return (
    <View style={styles.checklistCard}>
      <Text style={styles.checklistTitle}>Form Checklist</Text>
      <View style={styles.checklistTabs}>
        {(['before', 'during', 'after'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.checklistTab, activeTab === tab && styles.checklistTabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.checklistTabText, activeTab === tab && styles.checklistTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.checklistItem}>
          <Text style={styles.checklistBullet}>{'\u2022'}</Text>
          <Text style={styles.checklistItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Set Feedback Prompt ────────────────────────────────

interface SetFeedbackPromptProps {
  setId: string;
  onSubmit: (setId: string, feedback: SetFeedbackRating, bodyArea?: BodyArea) => void;
}

function SetFeedbackPrompt({ setId, onSubmit }: SetFeedbackPromptProps) {
  const [showBodyArea, setShowBodyArea] = useState(false);

  const BODY_AREAS: { label: string; value: BodyArea }[] = [
    { label: 'Knee', value: 'knee' },
    { label: 'Shoulder', value: 'shoulder' },
    { label: 'Back', value: 'back' },
    { label: 'Wrist', value: 'wrist' },
    { label: 'Neck', value: 'neck' },
    { label: 'Other', value: 'other' },
  ];

  if (showBodyArea) {
    return (
      <View style={styles.feedbackContainer}>
        <Text style={styles.feedbackDiscomfortWarning}>
          Consider reducing weight or stopping. If pain persists, seek a qualified professional.
        </Text>
        <Text style={styles.feedbackLabel}>Where?</Text>
        <View style={styles.feedbackChips}>
          {BODY_AREAS.map((area) => (
            <TouchableOpacity
              key={area.value}
              style={styles.feedbackBodyChip}
              onPress={() => {
                onSubmit(setId, 'discomfort', area.value);
                setShowBodyArea(false);
              }}
            >
              <Text style={styles.feedbackBodyChipText}>{area.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.feedbackContainer}>
      <Text style={styles.feedbackLabel}>Felt right?</Text>
      <View style={styles.feedbackChips}>
        <TouchableOpacity
          style={[styles.feedbackChip, styles.feedbackChipOk]}
          onPress={() => onSubmit(setId, 'ok')}
        >
          <Text style={styles.feedbackChipText}>OK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackChip, styles.feedbackChipUnstable]}
          onPress={() => onSubmit(setId, 'unstable')}
        >
          <Text style={styles.feedbackChipText}>Unstable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackChip, styles.feedbackChipDiscomfort]}
          onPress={() => setShowBodyArea(true)}
        >
          <Text style={styles.feedbackChipText}>Discomfort</Text>
        </TouchableOpacity>
      </View>
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
  checklist: FormChecklist | null;
  checklistEnabled: boolean;
  feedbackEnabled: boolean;
  lastLoggedSetId: string | null;
  onSubmitFeedback: (setId: string, feedback: SetFeedbackRating, bodyArea?: BodyArea) => void;
  feedbackSubmitted: Set<string>;
  safetyNudge?: SafetyNudge | null;
}

function ExerciseCard({
  exercise,
  onLogSet,
  loggingExerciseId,
  suggestion,
  onApplySuggestion,
  aiEnabled,
  checklist,
  checklistEnabled,
  feedbackEnabled,
  lastLoggedSetId,
  onSubmitFeedback,
  feedbackSubmitted,
  safetyNudge,
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

      {safetyNudge && (
        <View style={[
          styles.safetyNudge,
          safetyNudge.level === 'strong' ? styles.safetyNudgeStrong
            : safetyNudge.level === 'moderate' ? styles.safetyNudgeModerate
            : styles.safetyNudgeGentle,
        ]}>
          <Text style={styles.safetyNudgeText}>{safetyNudge.message}</Text>
        </View>
      )}

      {aiEnabled && (!safetyNudge || !safetyNudge.should_suppress_suggestion) && (
        <SuggestionCard suggestion={suggestion} onApply={handleApply} />
      )}

      {/* Form Checklist (collapsible) */}
      {checklistEnabled && checklist && (
        <ChecklistCard checklist={checklist} />
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

      {/* Set Feedback Prompt (shown after logging a set) */}
      {feedbackEnabled && lastLoggedSetId && !feedbackSubmitted.has(lastLoggedSetId) && (
        <SetFeedbackPrompt
          setId={lastLoggedSetId}
          onSubmit={onSubmitFeedback}
        />
      )}
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
      {Platform.OS === 'ios' ? (
        <BlurView tint="dark" intensity={40} style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Exercise</Text>

              <Text style={styles.modalLabel}>Exercise Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Bench Press"
                placeholderTextColor={colors.textDisabled}
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
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalAddText}>Add Exercise</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      ) : (
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Exercise</Text>

            <Text style={styles.modalLabel}>Exercise Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Bench Press"
              placeholderTextColor={colors.textDisabled}
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
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalAddText}>Add Exercise</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      )}
    </Modal>
  );
}

// ─── Rest Timer ──────────────────────────────────────────

const REST_DURATIONS = [60, 90, 120, 180]; // seconds

const REST_RING_SIZE = 148;
const REST_RING_STROKE = 6;
const REST_RING_RADIUS = (REST_RING_SIZE - REST_RING_STROKE) / 2;
const REST_RING_CIRCUMFERENCE = 2 * Math.PI * REST_RING_RADIUS;

interface RestTimerProps {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  onDismiss: () => void;
  onSetDuration: (seconds: number) => void;
  onAdjust: (deltaSeconds: number) => void;
}

function RestTimer({
  secondsLeft,
  totalSeconds,
  isRunning,
  onDismiss,
  onSetDuration,
  onAdjust,
}: RestTimerProps) {
  if (!isRunning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${minutes}:${secs.toString().padStart(2, '0')}`;
  const isFinished = secondsLeft <= 0;
  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;

  return (
    <View style={styles.restTimerOverlay}>
      <View style={styles.restTimerCard}>
        <View style={styles.restRingWrap}>
          <Svg
            width={REST_RING_SIZE}
            height={REST_RING_SIZE}
            viewBox={`0 0 ${REST_RING_SIZE} ${REST_RING_SIZE}`}
          >
            {/* Track */}
            <Circle
              cx={REST_RING_SIZE / 2}
              cy={REST_RING_SIZE / 2}
              r={REST_RING_RADIUS}
              stroke={colors.bgSkeleton}
              strokeWidth={REST_RING_STROKE}
              fill="none"
            />
            {/* Emissive crimson progress arc */}
            <Circle
              cx={REST_RING_SIZE / 2}
              cy={REST_RING_SIZE / 2}
              r={REST_RING_RADIUS}
              stroke={isFinished ? colors.primaryLight : colors.primary}
              strokeWidth={REST_RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${REST_RING_CIRCUMFERENCE}`}
              strokeDashoffset={REST_RING_CIRCUMFERENCE * (1 - progress)}
              rotation={-90}
              origin={`${REST_RING_SIZE / 2}, ${REST_RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.restRingCenter}>
            <Text style={styles.restTimerLabel}>
              {isFinished ? 'REST COMPLETE' : 'REST'}
            </Text>
            <Text style={[styles.restTimerDisplay, isFinished && styles.restTimerDisplayDone]}>
              {isFinished ? '0:00' : display}
            </Text>
          </View>
        </View>

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

        <View style={styles.restAdjustRow}>
          <TouchableOpacity
            style={styles.restAdjustButton}
            onPress={() => onAdjust(-15)}
            disabled={isFinished}
          >
            <Text style={styles.restAdjustText}>{'−'}15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restAdjustButton}
            onPress={() => onAdjust(15)}
            disabled={isFinished}
          >
            <Text style={styles.restAdjustText}>+15s</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.restTimerDismiss} onPress={onDismiss}>
          <Text style={styles.restTimerDismissText}>
            {isFinished ? 'DONE' : 'SKIP REST →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const { id: workoutId, intent: intentParam } = useLocalSearchParams<{ id: string; intent?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const sessionIntent = (['light', 'maintain', 'push'].includes(intentParam ?? '')
    ? intentParam as SessionIntent
    : 'push') as SessionIntent;

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

  // Phase 2.5.2: Checklist + Feedback state
  const [checklistEnabled, setChecklistEnabled] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [checklists, setChecklists] = useState<Record<string, FormChecklist>>({});
  const [lastLoggedSetIds, setLastLoggedSetIds] = useState<Record<string, string>>({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set());

  // Phase 2.5.4: Safety nudge state
  const [safetyNudges, setSafetyNudges] = useState<Record<string, SafetyNudge>>({});

  // Rest timer state
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restDuration, setRestDuration] = useState(90); // default 90s
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Enrichment: live elapsed time
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ─── Initialize feature flags + weight unit ──────────
  useEffect(() => {
    const initFlags = async () => {
      try {
        await refreshFeatureFlags();
        setAiEnabled(isFeatureEnabled('ai_assist_enabled'));
        setChecklistEnabled(isFeatureEnabled('ai_form_checklist'));
        setFeedbackEnabled(isFeatureEnabled('ai_form_checklist')); // tied to same flag
        const unit = await getWeightUnit();
        setWeightUnitState(unit);
      } catch {
        // Feature flags failed to load; AI assist stays disabled
        setAiEnabled(false);
      }
    };
    initFlags();
  }, []);

  // ─── Back nav guard: confirm before leaving active workout ──
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!workout || finishing) return; // Allow if no workout loaded or finishing
      e.preventDefault();
      Alert.alert(
        'Leave workout?',
        'Your current workout is still in progress. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, workout, finishing]);

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
  }, [restTimerRunning]);

  // ─── Live elapsed time ──────────────────────────────
  useEffect(() => {
    if (!workout) return;
    const startTime = new Date(workout.started_at).getTime();
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [workout]);

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

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    setRestSecondsLeft((prev) => Math.max(0, prev + deltaSeconds));
    if (deltaSeconds > 0) {
      // Keep the progress ring denominator in sync when extending rest
      setRestDuration((prev) => prev + deltaSeconds);
    }
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
            .eq('workouts.profile_id', workout.profile_id)
            .eq('workouts.status', 'completed')
            .neq('workout_id', workout.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (prevWorkoutExercises && prevWorkoutExercises.length > 0) {
            previousSets = (prevWorkoutExercises[0].sets ?? []) as WorkoutSet[];
          }
        }

        // Call the AI suggestion engine (pass session intent)
        const result = await getNextSetSuggestion({
          currentSets,
          previousSets,
          unit: weightUnit,
          intent: sessionIntent,
        });

        // Update suggestions state
        setSuggestions((prev) => ({
          ...prev,
          [exerciseId]: result,
        }));

        // Track the event
        trackEvent('ai_next_set_shown', { exercise_id: exerciseId });

        // Audit log
        logAiDecision('next_set', { exerciseId, currentSets }, { ...result });

        // ─── Phase 2.5.4: Safety nudge ────────────────
        if (isFeatureEnabled('ai_safety_loop') && workout) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const { data: feedbackData } = await supabase
                .from('set_feedback')
                .select('feedback, body_area')
                .eq('profile_id', user.id)
                .gte('created_at', sevenDaysAgo);

              if (feedbackData && feedbackData.length > 0) {
                const discomfortCount = feedbackData.filter(
                  (f: { feedback: string }) => f.feedback === 'discomfort' || f.feedback === 'pain',
                ).length;
                const unstableCount = feedbackData.filter(
                  (f: { feedback: string }) => f.feedback === 'unstable',
                ).length;

                // Get top body areas from discomfort/pain feedback
                const bodyAreas = feedbackData
                  .filter((f: { feedback: string; body_area: string | null }) =>
                    (f.feedback === 'discomfort' || f.feedback === 'pain') && f.body_area,
                  )
                  .map((f: { body_area: string }) => f.body_area);
                const uniqueAreas = [...new Set(bodyAreas)];

                const nudge = getSafetyNudge({
                  discomfortCount7d: discomfortCount,
                  unstableCount7d: unstableCount,
                  topBodyAreas: uniqueAreas,
                  exerciseName: exercise.exercise_name,
                });

                if (nudge) {
                  setSafetyNudges((prev) => ({ ...prev, [exerciseId]: nudge }));
                  trackEvent('safety_nudge_shown', {
                    exercise_id: exerciseId,
                    level: nudge.level,
                  });
                }
              }
            }
          } catch {
            // Non-critical
          }
        }
      } catch {
        // Don't block UX if AI suggestion fails
      }
    },
    [aiEnabled, exercises, workout, sessionIntent],
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

  // ─── Compute form checklists for exercises with machines ──
  useEffect(() => {
    if (!checklistEnabled || exercises.length === 0) return;

    const newChecklists: Record<string, FormChecklist> = {};
    for (const ex of exercises) {
      if (ex.machine && !checklists[ex.id]) {
        newChecklists[ex.id] = getFormChecklist({ machine: ex.machine });
      }
    }
    if (Object.keys(newChecklists).length > 0) {
      setChecklists((prev) => ({ ...prev, ...newChecklists }));
    }
  }, [exercises, checklistEnabled]);

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

    try {
      const { data } = await retryWithBackoff(
        async () => {
          const res = await supabase
            .from('sets')
            .insert(insertPayload)
            .select()
            .single();
          if (res.error) throw res.error;
          return res;
        },
        { maxRetries: 2, baseDelayMs: 300 },
      );

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

      // Track last logged set for feedback prompt
      setLastLoggedSetIds((prev) => ({ ...prev, [exerciseId]: serverSet.id }));

      // Start rest timer
      startRestTimer();

      // Compute AI suggestion async (don't block the UI)
      if (aiEnabled) {
        computeSuggestion(exerciseId);
      }
    } catch (err: unknown) {
      // Queue for offline replay instead of losing data
      await enqueueEvent('sets', insertPayload).catch(() => {});

      // Rollback optimistic update
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId
            ? { ...ex, sets: ex.sets.filter((s) => s.id !== tempId) }
            : ex,
        ),
      );
      Alert.alert(
        'Saved Offline',
        'Set queued and will sync when you\'re back online.',
      );
    } finally {
      setLoggingExerciseId(null);
    }
  };

  // ─── Handle apply suggestion ──────────────────────
  const handleApplySuggestion = (exerciseId: string) => {
    trackEvent('ai_next_set_applied', { exercise_id: exerciseId });
  };

  // ─── Handle set feedback ───────────────────────────
  const handleSubmitFeedback = async (
    setId: string,
    feedback: SetFeedbackRating,
    bodyArea?: BodyArea,
  ) => {
    // Optimistic: mark as submitted immediately
    setFeedbackSubmitted((prev) => new Set([...prev, setId]));

    if (!workout) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the exercise that owns this set
      const exercise = exercises.find((ex) =>
        ex.sets.some((s) => s.id === setId),
      );
      if (!exercise) return;

      await supabase.from('set_feedback').insert({
        gym_id: workout.gym_id,
        profile_id: user.id,
        workout_id: workout.id,
        workout_exercise_id: exercise.id,
        set_id: setId,
        feedback,
        body_area: bodyArea ?? null,
      });

      trackEvent('set_feedback_submitted', { set_id: setId, feedback, body_area: bodyArea });
    } catch {
      // Non-fatal — feedback is best-effort
    }
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
        <ActivityIndicator size="large" color={colors.primary} />
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

  // ─── Computed enrichment values ─────────────────────
  const totalSetsLogged = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolumeKg = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((sSum, s) => sSum + s.weight_kg * s.reps, 0);
  }, 0);
  const exercisesWithSets = exercises.filter((ex) => ex.sets.length > 0).length;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedDisplay = elapsedHours > 0
    ? `${elapsedHours}h ${elapsedMinutes % 60}m`
    : `${elapsedMinutes}m ${elapsedSeconds % 60}s`;

  const intentCfg = INTENT_CONFIG[sessionIntent] ?? INTENT_CONFIG.push;

  // ─── Render: Active Workout ─────────────────────────
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Header with elapsed time ─────────────── */}
        <View style={styles.workoutHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Active Workout</Text>
            <Text style={styles.subtitle}>
              Started at{' '}
              {new Date(workout.started_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.elapsedContainer}>
            <Text style={styles.elapsedTime}>{elapsedDisplay}</Text>
            <Text style={styles.elapsedLabel}>elapsed</Text>
          </View>
        </View>

        {/* ─── Session Intent Badge ─────────────────── */}
        <View style={[styles.intentBadge, { backgroundColor: intentCfg.color + '18' }]}>
          <Text style={styles.intentEmoji}>{intentCfg.emoji}</Text>
          <Text style={[styles.intentLabel, { color: intentCfg.color }]}>
            {intentCfg.label} session
          </Text>
        </View>

        {/* ─── Live Stats Strip ─────────────────────── */}
        <View style={styles.liveStatsStrip}>
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>{totalSetsLogged}</Text>
            <Text style={styles.liveStatLabel}>sets</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>
              {totalVolumeKg >= 1000
                ? `${(totalVolumeKg / 1000).toFixed(1)}t`
                : `${Math.round(totalVolumeKg)}kg`}
            </Text>
            <Text style={styles.liveStatLabel}>volume</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>{exercises.length}</Text>
            <Text style={styles.liveStatLabel}>exercises</Text>
          </View>
        </View>

        {/* ─── Session Progress Bar ─────────────────── */}
        {exercises.length > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                {exercisesWithSets} of {exercises.length} exercises started
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(exercisesWithSets / exercises.length) * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

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
            checklist={checklists[exercise.id] ?? null}
            checklistEnabled={checklistEnabled}
            feedbackEnabled={feedbackEnabled}
            lastLoggedSetId={lastLoggedSetIds[exercise.id] ?? null}
            onSubmitFeedback={handleSubmitFeedback}
            feedbackSubmitted={feedbackSubmitted}
            safetyNudge={safetyNudges[exercise.id] ?? null}
          />
        ))}

        <TouchableOpacity
          style={[styles.finishButton, finishing && styles.finishButtonDisabled]}
          onPress={handleFinishWorkout}
          disabled={finishing}
        >
          {finishing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.finishButtonText}>Finish Workout</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Rest Timer */}
      <RestTimer
        secondsLeft={restSecondsLeft}
        totalSeconds={restDuration}
        isRunning={restTimerRunning}
        onDismiss={dismissRestTimer}
        onSetDuration={changeRestDuration}
        onAdjust={adjustRestTimer}
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
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginBottom: 0,
  },
  elapsedContainer: {
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  elapsedTime: {
    fontSize: 18,
    fontFamily: typography.fontMonoBold,
    color: colors.primaryLight,
    fontVariant: ['tabular-nums'],
  },
  elapsedLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Session intent badge
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  intentEmoji: {
    fontSize: 14,
  },
  intentLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Live stats strip
  liveStatsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    marginBottom: 10,
  },
  liveStatPill: {
    alignItems: 'center',
    flex: 1,
  },
  liveStatValue: {
    fontSize: 18,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  liveStatLabel: {
    fontSize: 10,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  liveStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // Session progress bar
  progressContainer: {
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgSkeleton,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // Loading / Error
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.error,
    color: colors.white,
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
    color: colors.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Exercise Card
  exerciseCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 20,
    fontFamily: typography.fontBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  machineName: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
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
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  setHeaderText: {
    flex: 1,
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  setNumber: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontMonoBold,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  setValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontMono,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  setRpe: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontMono,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  noSetsText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
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
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textInverse,
  },
  suggestionValues: {
    fontSize: 20,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  suggestionReason: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  suggestionSafetyNote: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.error,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  suggestionApplyButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  suggestionApplyButtonText: {
    color: colors.primaryLight,
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
  },

  // Add Set (set logger — Stitch set-logger layout)
  addSetSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  addSetLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addSetContainer: {
    gap: 12,
  },
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  addSetField: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  addSetFieldSmall: {
    flex: 0.6,
  },
  addSetFieldLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addSetInput: {
    alignSelf: 'stretch',
    height: 44,
    fontSize: 24,
    fontFamily: typography.fontMonoBold,
    fontVariant: ['tabular-nums'],
    color: colors.text,
    textAlign: 'center',
    padding: 0,
  },
  logSetButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  logSetButtonDisabled: {
    backgroundColor: colors.primaryDark,
  },
  logSetButtonText: {
    color: colors.textOnAccent,
    fontSize: 16,
    fontFamily: typography.fontBold,
    letterSpacing: 1.5,
  },

  // Finish Button — primary CTA, solid crimson
  finishButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  finishButtonDisabled: {
    backgroundColor: colors.primaryDark,
  },
  finishButtonText: {
    color: colors.textOnAccent,
    fontSize: 16,
    fontFamily: typography.fontBold,
    letterSpacing: 1,
  },

  // Rest Timer — emissive crimson countdown (Stitch rest-timer)
  restTimerOverlay: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
  },
  restTimerCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  restRingWrap: {
    width: REST_RING_SIZE,
    height: REST_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  restRingCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerLabel: {
    fontSize: 10,
    fontFamily: typography.fontSemiBold,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  restTimerDisplay: {
    fontSize: 40,
    fontFamily: typography.fontMonoBold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  restTimerDisplayDone: {
    color: colors.primaryLight,
  },
  restTimerDurations: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  restDurationChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  restDurationChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: typography.fontMono,
    fontVariant: ['tabular-nums'],
  },
  restAdjustRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  restAdjustButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  restAdjustText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: typography.fontMono,
    fontVariant: ['tabular-nums'],
  },
  restTimerDismiss: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  restTimerDismissText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // FAB — crimson gateway with glow
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  fabText: {
    fontSize: 28,
    color: colors.textOnAccent,
    fontWeight: '600',
    lineHeight: 30,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  modalLabel: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.text,
    backgroundColor: colors.bgInput,
    marginBottom: 16,
  },
  machineList: {
    maxHeight: 180,
    marginBottom: 20,
  },
  machineItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  machineItemSelected: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.borderAccent,
  },
  machineItemText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.text,
  },
  machineItemTextSelected: {
    color: colors.primaryLight,
    fontFamily: typography.fontSemiBold,
  },
  emptyMachineText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  modalAddButtonDisabled: {
    backgroundColor: colors.primaryDark,
  },
  modalAddText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.textOnAccent,
  },

  // ─── Form Checklist Styles ─────────────────────────
  checklistCard: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checklistTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  checklistTab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceHighest,
  },
  checklistTabActive: {
    backgroundColor: colors.primary,
  },
  checklistTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  checklistTabTextActive: {
    color: colors.white,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  checklistBullet: {
    fontSize: 14,
    color: colors.primary,
    marginRight: 6,
    lineHeight: 18,
  },
  checklistItemText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },

  // ─── Set Feedback Styles ───────────────────────────
  feedbackContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
  },
  feedbackLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  feedbackChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  feedbackChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  feedbackChipOk: {
    backgroundColor: colors.successSubtle,
    borderColor: colors.success,
  },
  feedbackChipUnstable: {
    backgroundColor: colors.goldSubtle,
    borderColor: colors.gold,
  },
  feedbackChipDiscomfort: {
    backgroundColor: colors.errorSubtle,
    borderColor: colors.error,
  },
  feedbackChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  feedbackBodyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceHighest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackBodyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  feedbackDiscomfortWarning: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  // Safety nudge styles
  safetyNudge: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  safetyNudgeGentle: {
    backgroundColor: colors.primarySubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  safetyNudgeModerate: {
    backgroundColor: colors.goldSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  safetyNudgeStrong: {
    backgroundColor: colors.errorSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  safetyNudgeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    fontWeight: '500',
  },
});
