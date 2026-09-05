/**
 * Today's workout logger — sessions model.
 *
 * Always renders TODAY's workout_sessions for the member, regardless of the
 * route param (`/workout/today` is the canonical push; any legacy id also
 * lands here and resolves to today). All set writes go through sessionApi
 * (lbs canonical); one session row per member+machine+day is upserted
 * server-side on the first logged set.
 */
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
  Platform,
  Vibration,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../src/lib/supabase';
import type { Machine } from '@nexera/types';
import { getNextSetSuggestion, getFormChecklist, getSafetyNudge } from '@nexera/ai-assist';
import type { SafetyNudge } from '@nexera/ai-assist';
import type { SessionIntent } from '@nexera/types';
import type { NextSetSuggestion, WeightUnit, FormChecklist, SetFeedbackRating, BodyArea } from '@nexera/types';
import { isFeatureEnabled, refreshFeatureFlags } from '../../src/lib/featureFlags';
import { trackEvent } from '../../src/lib/events';
import { logAiDecision } from '../../src/lib/aiAudit';
import { getWeightUnit } from '../../src/lib/weightUnit';
import { flushQueue } from '../../src/lib/offlineQueue';
import {
  logSet,
  completeSession,
  prCheck,
  replayQueuedSet,
  localSessionDate,
  type SessionSetEntry,
  type WorkoutMode as ApiWorkoutMode,
  type PrResult,
  type CompleteSessionResult,
} from '../../src/lib/sessionApi';
import {
  resolveWorkoutIdentity,
  toApiWorkoutMode,
  validateSetInput,
  sessionSetsToKg,
  stashCompletionResults,
  stashPrResult,
  type WorkoutIdentity,
} from '../../src/lib/activeWorkout';
import { detectWorkoutMode } from '../../src/lib/workoutMode';
import { convertFromLbs, convertToLbs, formatWeightLbs, formatVolumeLbs } from '../../src/lib/feedLogic';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

// ─── Types ──────────────────────────────────────────────

interface ExerciseEntry {
  machineId: string;
  machineName: string;
  /** Server session id — null until the first set is logged. */
  sessionId: string | null;
  /** Server-confirmed sets (lbs). */
  sets: SessionSetEntry[];
  /** Locally queued sets awaiting offline replay (lbs). */
  pendingSets: SessionSetEntry[];
  totalVolumeLbs: number;
  bestWeightLbs: number;
  completedAt: string | null;
}

// ─── Helpers ────────────────────────────────────────────

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

/** Convert an ai-assist kg suggestion to a display-unit number. */
function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') return Math.round(kg * 10) / 10;
  return Math.round(convertToLbs(kg, 'kg')); // kg → lbs
}

/** Convert stored lbs to a display-unit number for input prefill. */
function lbsToDisplay(lbs: number, unit: WeightUnit): number {
  const v = convertFromLbs(lbs, unit);
  return unit === 'kg' ? Math.round(v * 10) / 10 : Math.round(v);
}

// ─── Session intent config ─────────────────────────────

const INTENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  light: { label: 'Light', color: colors.success, emoji: '🌿' },
  maintain: { label: 'Maintain', color: colors.gold, emoji: '⚖️' },
  push: { label: 'Push', color: colors.error, emoji: '🔥' },
};

// ─── Set Row ────────────────────────────────────────────

interface SetRowProps {
  set: SessionSetEntry;
  unit: WeightUnit;
  queued?: boolean;
}

function SetRow({ set, unit, queued }: SetRowProps) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>#{set.set_number}</Text>
      <Text style={styles.setValue}>{formatWeightLbs(set.weight_lbs, unit)}</Text>
      <Text style={styles.setValue}>
        {set.reps} rep{set.reps !== 1 ? 's' : ''}
      </Text>
      {queued ? (
        <Text style={styles.setQueued}>queued</Text>
      ) : set.rpe != null ? (
        <Text style={styles.setRpe}>RPE {set.rpe}</Text>
      ) : (
        <Text style={styles.setRpe} />
      )}
    </View>
  );
}

// ─── Suggestion Card ────────────────────────────────────

interface SuggestionCardProps {
  suggestion: NextSetSuggestion | null;
  unit: WeightUnit;
  onApply: () => void;
}

function SuggestionCard({ suggestion, unit, onApply }: SuggestionCardProps) {
  if (!suggestion) return null;

  const confidenceLabel = getConfidenceLabel(suggestion.confidence);
  const confidenceColor = getConfidenceColor(suggestion.confidence);
  const weightText =
    suggestion.suggested_weight != null
      ? `${kgToDisplay(suggestion.suggested_weight, unit)} ${unit}`
      : 'Bodyweight';

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
        {weightText} x {suggestion.suggested_reps} reps
      </Text>

      <Text style={styles.suggestionReason}>
        Why: {suggestion.reason_text}
      </Text>

      {suggestion.safety_note ? (
        <Text style={styles.suggestionSafetyNote}>
          {suggestion.safety_note}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.suggestionApplyButton}
        onPress={onApply}
        accessibilityRole="button"
        accessibilityLabel="Apply suggested weight and reps"
      >
        <Text style={styles.suggestionApplyButtonText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Set Form ───────────────────────────────────────

interface AddSetFormProps {
  unit: WeightUnit;
  lastWeightDisplay: number;
  onLogSet: (weight: number, reps: number, rpe: number | undefined) => void;
  isLogging: boolean;
  prefillWeight?: number | null;
  prefillReps?: number | null;
}

function AddSetForm({
  unit,
  lastWeightDisplay,
  onLogSet,
  isLogging,
  prefillWeight,
  prefillReps,
}: AddSetFormProps) {
  const [weight, setWeight] = useState(lastWeightDisplay.toString());
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');

  // Keep weight in sync when the last logged weight changes
  useEffect(() => {
    setWeight(lastWeightDisplay.toString());
  }, [lastWeightDisplay]);

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

    onLogSet(weightNum, repsNum, rpeNum);
    setReps('');
    setRpe('');
  };

  return (
    <View style={styles.addSetContainer}>
      <View style={styles.addSetRow}>
        <View style={styles.addSetField}>
          <Text style={styles.addSetFieldLabel}>Weight ({unit})</Text>
          <TextInput
            style={styles.addSetInput}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
            accessibilityLabel={`Weight in ${unit}`}
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
            accessibilityLabel="Reps"
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
            accessibilityLabel="RPE, optional, 1 to 10"
          />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.logSetButton, isLogging && styles.logSetButtonDisabled]}
        onPress={handleLog}
        disabled={isLogging}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Log set"
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
            accessibilityRole="button"
            accessibilityLabel={`${tab} checklist`}
          >
            <Text style={[styles.checklistTabText, activeTab === tab && styles.checklistTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.checklistItem}>
          <Text style={styles.checklistBullet}>{'•'}</Text>
          <Text style={styles.checklistItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Set Feedback Prompt ────────────────────────────────

interface SetFeedbackPromptProps {
  feedbackKey: string;
  onSubmit: (feedbackKey: string, feedback: SetFeedbackRating, bodyArea?: BodyArea) => void;
}

function SetFeedbackPrompt({ feedbackKey, onSubmit }: SetFeedbackPromptProps) {
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
                onSubmit(feedbackKey, 'discomfort', area.value);
                setShowBodyArea(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Discomfort in ${area.label}`}
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
          onPress={() => onSubmit(feedbackKey, 'ok')}
          accessibilityRole="button"
          accessibilityLabel="Set felt OK"
        >
          <Text style={styles.feedbackChipText}>OK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackChip, styles.feedbackChipUnstable]}
          onPress={() => onSubmit(feedbackKey, 'unstable')}
          accessibilityRole="button"
          accessibilityLabel="Set felt unstable"
        >
          <Text style={styles.feedbackChipText}>Unstable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedbackChip, styles.feedbackChipDiscomfort]}
          onPress={() => setShowBodyArea(true)}
          accessibilityRole="button"
          accessibilityLabel="Set caused discomfort"
        >
          <Text style={styles.feedbackChipText}>Discomfort</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Exercise Card ──────────────────────────────────────

interface ExerciseCardProps {
  exercise: ExerciseEntry;
  unit: WeightUnit;
  onLogSet: (machineId: string, weight: number, reps: number, rpe: number | undefined) => void;
  loggingMachineId: string | null;
  suggestion: NextSetSuggestion | null;
  aiEnabled: boolean;
  checklist: FormChecklist | null;
  checklistEnabled: boolean;
  feedbackEnabled: boolean;
  lastLoggedSetNumber: number | null;
  onSubmitFeedback: (feedbackKey: string, feedback: SetFeedbackRating, bodyArea?: BodyArea) => void;
  feedbackSubmitted: Set<string>;
  safetyNudge?: SafetyNudge | null;
}

function ExerciseCard({
  exercise,
  unit,
  onLogSet,
  loggingMachineId,
  suggestion,
  aiEnabled,
  checklist,
  checklistEnabled,
  feedbackEnabled,
  lastLoggedSetNumber,
  onSubmitFeedback,
  feedbackSubmitted,
  safetyNudge,
}: ExerciseCardProps) {
  const allSets = [...exercise.sets, ...exercise.pendingSets];
  const lastSet = allSets[allSets.length - 1];
  const lastWeightDisplay = lastSet ? lbsToDisplay(lastSet.weight_lbs, unit) : 0;
  const isDone = exercise.completedAt != null;

  const [prefillWeight, setPrefillWeight] = useState<number | null>(null);
  const [prefillReps, setPrefillReps] = useState<number | null>(null);

  const handleApply = () => {
    if (suggestion) {
      setPrefillWeight(
        suggestion.suggested_weight != null
          ? kgToDisplay(suggestion.suggested_weight, unit)
          : 0,
      );
      setPrefillReps(suggestion.suggested_reps);
    }
    trackEvent('ai_next_set_applied', { machine_id: exercise.machineId });
  };

  const feedbackKey =
    lastLoggedSetNumber != null ? `${exercise.machineId}:${lastLoggedSetNumber}` : null;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderRow}>
          <Text style={styles.exerciseName}>{exercise.machineName}</Text>
          {isDone && (
            <View style={styles.doneChip}>
              <Text style={styles.doneChipText}>{'✓'} Done</Text>
            </View>
          )}
        </View>
        {allSets.length > 0 && (
          <Text style={styles.machineName}>
            {formatVolumeLbs(exercise.totalVolumeLbs, unit)} volume
          </Text>
        )}
      </View>

      {allSets.length > 0 && (
        <View style={styles.setsContainer}>
          <View style={styles.setHeaderRow}>
            <Text style={styles.setHeaderText}>Set</Text>
            <Text style={styles.setHeaderText}>Weight</Text>
            <Text style={styles.setHeaderText}>Reps</Text>
            <Text style={styles.setHeaderText}>RPE</Text>
          </View>
          {exercise.sets.map((set) => (
            <SetRow key={`s-${set.set_number}`} set={set} unit={unit} />
          ))}
          {exercise.pendingSets.map((set, i) => (
            <SetRow key={`p-${i}`} set={set} unit={unit} queued />
          ))}
        </View>
      )}

      {allSets.length === 0 && (
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

      {!isDone && aiEnabled && (!safetyNudge || !safetyNudge.should_suppress_suggestion) && (
        <SuggestionCard suggestion={suggestion} unit={unit} onApply={handleApply} />
      )}

      {/* Form Checklist */}
      {!isDone && checklistEnabled && checklist && (
        <ChecklistCard checklist={checklist} />
      )}

      {!isDone && (
        <View style={styles.addSetSection}>
          <Text style={styles.addSetLabel}>Add Set</Text>
          <AddSetForm
            unit={unit}
            lastWeightDisplay={lastWeightDisplay}
            onLogSet={(weight, reps, rpe) => onLogSet(exercise.machineId, weight, reps, rpe)}
            isLogging={loggingMachineId === exercise.machineId}
            prefillWeight={prefillWeight}
            prefillReps={prefillReps}
          />
        </View>
      )}

      {/* Set Feedback Prompt (only for server-confirmed sets) */}
      {!isDone &&
        feedbackEnabled &&
        exercise.sessionId != null &&
        feedbackKey != null &&
        !feedbackSubmitted.has(feedbackKey) && (
          <SetFeedbackPrompt feedbackKey={feedbackKey} onSubmit={onSubmitFeedback} />
        )}
    </View>
  );
}

// ─── Add Machine Modal (machine picker only) ────────────

interface AddMachineModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (machine: { id: string; name: string }) => void;
  machines: Array<{ id: string; name: string }>;
}

function AddMachineModal({ visible, onClose, onAdd, machines }: AddMachineModalProps) {
  const content = (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Add Machine</Text>

      <FlatList
        data={machines}
        keyExtractor={(item) => item.id}
        style={styles.machineList}
        ListEmptyComponent={
          <Text style={styles.emptyMachineText}>No machines available</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.machineItem}
            onPress={() => onAdd(item)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to workout`}
          >
            <Text style={styles.machineItemText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalCancelButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel adding machine"
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {Platform.OS === 'ios' ? (
        <BlurView tint="dark" intensity={40} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>{content}</View>
        </BlurView>
      ) : (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>{content}</View>
        </View>
      )}
    </Modal>
  );
}

// ─── PR Banner ──────────────────────────────────────────

interface PrBannerState {
  pr: PrResult;
  machineName: string;
}

function prBannerText(pr: PrResult, unit: WeightUnit): string {
  switch (pr.type) {
    case 'first_session':
      return 'First session on this machine — baseline set!';
    case 'weight':
      return `New best weight: ${formatWeightLbs(pr.value, unit)}${
        pr.improvementPct != null ? ` (+${pr.improvementPct}%)` : ''
      }`;
    case 'volume':
      return `New best volume: ${formatVolumeLbs(pr.value, unit)}${
        pr.improvementPct != null ? ` (+${pr.improvementPct}%)` : ''
      }`;
    default:
      return 'New personal record!';
  }
}

function PrBanner({ banner, unit, onDismiss }: {
  banner: PrBannerState;
  unit: WeightUnit;
  onDismiss: () => void;
}) {
  return (
    <View
      style={styles.prBanner}
      accessibilityRole="alert"
      accessibilityLabel={`Personal record on ${banner.machineName}. ${prBannerText(banner.pr, unit)}`}
    >
      <Text style={styles.prBannerTrophy}>{'🏆'}</Text>
      <View style={styles.prBannerBody}>
        <Text style={styles.prBannerTitle}>PR — {banner.machineName}</Text>
        <Text style={styles.prBannerText}>{prBannerText(banner.pr, unit)}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss personal record banner"
        style={styles.prBannerDismiss}
      >
        <Text style={styles.prBannerDismissText}>{'✕'}</Text>
      </TouchableOpacity>
    </View>
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
              accessibilityRole="button"
              accessibilityLabel={`Set rest to ${d} seconds`}
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
            accessibilityRole="button"
            accessibilityLabel="Reduce rest by 15 seconds"
          >
            <Text style={styles.restAdjustText}>{'−'}15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restAdjustButton}
            onPress={() => onAdjust(15)}
            disabled={isFinished}
            accessibilityRole="button"
            accessibilityLabel="Extend rest by 15 seconds"
          >
            <Text style={styles.restAdjustText}>+15s</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.restTimerDismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={isFinished ? 'Dismiss rest timer' : 'Skip rest'}
        >
          <Text style={styles.restTimerDismissText}>
            {isFinished ? 'DONE' : 'SKIP REST →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────

export default function TodayWorkoutScreen() {
  // The [id] param is a routing token — 'today' is canonical; the screen
  // always loads today's sessions for the signed-in member.
  const { intent: intentParam, machineId: machineIdParam } = useLocalSearchParams<{
    id: string;
    intent?: string;
    machineId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const sessionIntent = (['light', 'maintain', 'push'].includes(intentParam ?? '')
    ? intentParam as SessionIntent
    : 'push') as SessionIntent;

  const [identity, setIdentity] = useState<WorkoutIdentity | null>(null);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingMachineId, setLoggingMachineId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Machine catalog (picker + names + checklists)
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showAddMachine, setShowAddMachine] = useState(false);

  // AI Assist state
  const [suggestions, setSuggestions] = useState<Record<string, NextSetSuggestion>>({});
  const [aiEnabled, setAiEnabled] = useState(false);
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lbs');

  // Checklist + feedback state
  const [checklistEnabled, setChecklistEnabled] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [lastLoggedSetNumbers, setLastLoggedSetNumbers] = useState<Record<string, number>>({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set());

  // Safety nudge state
  const [safetyNudges, setSafetyNudges] = useState<Record<string, SafetyNudge>>({});

  // PR banner
  const [prBanner, setPrBanner] = useState<PrBannerState | null>(null);

  // Rest timer state
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restDuration, setRestDuration] = useState(90); // default 90s
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live elapsed time (earliest set today, else screen mount)
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const workoutModeRef = useRef<ApiWorkoutMode>('free');
  const offlineAlertShownRef = useRef(false);
  const prevSetsCacheRef = useRef<Record<string, SessionSetEntry[]>>({});

  // ─── Initial load ─────────────────────────────────────
  const loadToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Replay any offline-queued sets first (fire-and-forget on failure)
      flushQueue(replayQueuedSet).catch(() => {});

      const [ident, unit] = await Promise.all([
        resolveWorkoutIdentity(),
        getWeightUnit(),
      ]);
      setWeightUnitState(unit);

      if (!ident) {
        setError('Please sign in to log a workout.');
        return;
      }
      setIdentity(ident);

      // Workout mode context (non-fatal)
      try {
        const ctx = await detectWorkoutMode(ident.userId);
        workoutModeRef.current = toApiWorkoutMode(ctx.mode);
      } catch {
        workoutModeRef.current = 'free';
      }

      // Today's session rows + the gym's machine catalog in parallel
      const today = localSessionDate();
      const [sessionsRes, machinesRes] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('id, machine_id, sets, sets_count, total_volume_lbs, best_weight_lbs, completed_at, workout_mode')
          .eq('member_id', ident.memberId)
          .eq('session_date', today),
        supabase
          .from('machines')
          .select(
            'id, name, gym_id, qr_slug, muscle_groups, setup_steps, safety_cues, ' +
              'movement_pattern, equipment_type, form_checklist_before, ' +
              'form_checklist_during, form_checklist_after, checklist_version',
          )
          .eq('gym_id', ident.gymId)
          .eq('is_active', true),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;

      const machineRows = (machinesRes.data ?? []) as unknown as Machine[];
      setMachines(machineRows);
      const nameById = new Map(machineRows.map((m) => [m.id, m.name]));

      const rows = (sessionsRes.data ?? []) as Array<{
        id: string;
        machine_id: string;
        sets: SessionSetEntry[] | null;
        sets_count: number | null;
        total_volume_lbs: number | null;
        best_weight_lbs: number | null;
        completed_at: string | null;
        workout_mode: ApiWorkoutMode | null;
      }>;

      const entries: ExerciseEntry[] = rows.map((row) => ({
        machineId: row.machine_id,
        machineName: nameById.get(row.machine_id) ?? 'Machine',
        sessionId: row.id,
        sets: row.sets ?? [],
        pendingSets: [],
        totalVolumeLbs: row.total_volume_lbs ?? 0,
        bestWeightLbs: row.best_weight_lbs ?? 0,
        completedAt: row.completed_at,
      }));

      // Pre-add the machine from the query param (e.g. from the machine screen)
      if (machineIdParam && !entries.some((e) => e.machineId === machineIdParam)) {
        entries.push({
          machineId: machineIdParam,
          machineName: nameById.get(machineIdParam) ?? 'Machine',
          sessionId: null,
          sets: [],
          pendingSets: [],
          totalVolumeLbs: 0,
          bestWeightLbs: 0,
          completedAt: null,
        });
      }

      // Sort: active first, completed last
      entries.sort((a, b) => Number(a.completedAt != null) - Number(b.completedAt != null));
      setExercises(entries);

      // Elapsed clock starts at the earliest set logged today
      const earliest = rows
        .flatMap((r) => r.sets ?? [])
        .map((s) => new Date(s.logged_at).getTime())
        .filter((t) => !Number.isNaN(t))
        .sort((a, b) => a - b)[0];
      startTimeRef.current = earliest ?? Date.now();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  }, [machineIdParam]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // ─── Feature flags + weight unit ─────────────────────
  useEffect(() => {
    const initFlags = async () => {
      try {
        await refreshFeatureFlags();
        setAiEnabled(isFeatureEnabled('ai_assist_enabled'));
        setChecklistEnabled(isFeatureEnabled('ai_form_checklist'));
        setFeedbackEnabled(isFeatureEnabled('ai_form_checklist')); // tied to same flag
      } catch {
        setAiEnabled(false);
      }
    };
    initFlags();
  }, []);

  // ─── Back nav guard: confirm before leaving an active workout ──
  const hasActiveSessions = exercises.some(
    (e) => e.completedAt == null && (e.sets.length > 0 || e.pendingSets.length > 0),
  );
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasActiveSessions || finishing) return;
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
  }, [navigation, hasActiveSessions, finishing]);

  // ─── Rest timer logic ─────────────────────────────────
  useEffect(() => {
    if (restTimerRunning && restSecondsLeft > 0) {
      restIntervalRef.current = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev <= 1) {
            // Vibrate exactly once, on the 1 → 0 transition. The interval
            // keeps ticking at 0 (deps exclude secondsLeft), so an
            // unconditional vibrate here would buzz every second until
            // the timer is dismissed.
            if (prev === 1) Vibration.vibrate(500);
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
    if (loading) return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [loading]);

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
      setRestDuration((prev) => prev + deltaSeconds);
    }
  }, []);

  // ─── Compute AI suggestion ────────────────────────────
  const computeSuggestion = useCallback(
    async (machineId: string, machineName: string, currentSets: SessionSetEntry[]) => {
      if (!aiEnabled || !identity) return;

      try {
        // Previous session sets for this machine (cached per machine)
        let previousSets = prevSetsCacheRef.current[machineId];
        if (previousSets == null) {
          const { data: prevRows } = await supabase
            .from('workout_sessions')
            .select('sets')
            .eq('member_id', identity.memberId)
            .eq('machine_id', machineId)
            .lt('session_date', localSessionDate())
            .order('session_date', { ascending: false })
            .limit(1);
          previousSets = ((prevRows?.[0]?.sets ?? []) as SessionSetEntry[]);
          prevSetsCacheRef.current[machineId] = previousSets;
        }

        // ai-assist operates in kg — adapt at the boundary
        const result = getNextSetSuggestion({
          currentSets: sessionSetsToKg(currentSets),
          previousSets: sessionSetsToKg(previousSets),
          unit: 'kg',
          intent: sessionIntent,
        });

        setSuggestions((prev) => ({ ...prev, [machineId]: result }));
        trackEvent('ai_next_set_shown', { machine_id: machineId });
        logAiDecision('next_set', { machineId, currentSets }, { ...result });

        // ─── Safety nudge (7-day feedback trends) ────
        if (isFeatureEnabled('ai_safety_loop')) {
          try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: feedbackData } = await supabase
              .from('set_feedback')
              .select('feedback, body_area')
              .eq('profile_id', identity.userId)
              .gte('created_at', sevenDaysAgo);

            if (feedbackData && feedbackData.length > 0) {
              const discomfortCount = feedbackData.filter(
                (f: { feedback: string }) => f.feedback === 'discomfort' || f.feedback === 'pain',
              ).length;
              const unstableCount = feedbackData.filter(
                (f: { feedback: string }) => f.feedback === 'unstable',
              ).length;

              const bodyAreas = feedbackData
                .filter((f: { feedback: string; body_area: string | null }) =>
                  (f.feedback === 'discomfort' || f.feedback === 'pain') && f.body_area,
                )
                .map((f: { body_area: string | null }) => f.body_area as string);
              const uniqueAreas = [...new Set(bodyAreas)];

              const nudge = getSafetyNudge({
                discomfortCount7d: discomfortCount,
                unstableCount7d: unstableCount,
                topBodyAreas: uniqueAreas,
                exerciseName: machineName,
              });

              if (nudge) {
                setSafetyNudges((prev) => ({ ...prev, [machineId]: nudge }));
                trackEvent('safety_nudge_shown', {
                  machine_id: machineId,
                  level: nudge.level,
                });
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
    [aiEnabled, identity, sessionIntent],
  );

  // ─── Log a set ──────────────────────────────────────
  const handleLogSet = async (
    machineId: string,
    weightDisplay: number,
    reps: number,
    rpe: number | undefined,
  ) => {
    const validationError = validateSetInput(weightDisplay, weightUnit, reps, rpe ?? null);
    if (validationError) {
      Alert.alert('Invalid set', validationError);
      return;
    }
    if (!identity) return;

    const exercise = exercises.find((e) => e.machineId === machineId);
    if (!exercise) return;

    setLoggingMachineId(machineId);
    const weightLbs = convertToLbs(weightDisplay, weightUnit);

    try {
      const result = await logSet({
        gym_id: identity.gymId,
        machine_id: machineId,
        member_id: identity.memberId,
        session_date: localSessionDate(),
        workout_mode: workoutModeRef.current,
        set: { weight_lbs: weightLbs, reps, rpe: rpe ?? null },
      });

      if (result === 'unavailable') {
        Alert.alert(
          'Connection Required',
          'Set logging needs the app server. Check your connection and try again.',
        );
        return;
      }

      if (result === 'queued') {
        // Offline: keep a local pending entry; it replays on next launch/load
        const localSetNumber =
          exercise.sets.length + exercise.pendingSets.length + 1;
        const pendingEntry: SessionSetEntry = {
          set_number: localSetNumber,
          weight_lbs: weightLbs,
          reps,
          rpe: rpe ?? null,
          notes: null,
          logged_at: new Date().toISOString(),
        };
        setExercises((prev) =>
          prev.map((e) =>
            e.machineId === machineId
              ? { ...e, pendingSets: [...e.pendingSets, pendingEntry] }
              : e,
          ),
        );
        if (!offlineAlertShownRef.current) {
          offlineAlertShownRef.current = true;
          Alert.alert(
            'Saved Offline',
            'Set queued and will sync when you\'re back online.',
          );
        }
        startRestTimer();
        return;
      }

      // Success — reconcile the card from the server response
      setExercises((prev) =>
        prev.map((e) =>
          e.machineId === machineId
            ? {
                ...e,
                sessionId: result.session_id,
                sets: result.sets,
                pendingSets: [],
                totalVolumeLbs: result.total_volume_lbs,
                bestWeightLbs: result.best_weight_lbs,
              }
            : e,
        ),
      );

      trackEvent('set_logged', {
        machine_id: machineId,
        set_number: result.set_number,
        weight_lbs: weightLbs,
        reps,
        rpe,
      });

      setLastLoggedSetNumbers((prev) => ({ ...prev, [machineId]: result.set_number }));
      startRestTimer();

      // PR check — non-blocking; celebrate + stash for the complete screen
      prCheck({
        session_id: result.session_id,
        member_id: identity.memberId,
        machine_id: machineId,
        weight_lbs: weightLbs,
        reps,
      })
        .then((pr) => {
          if (pr) {
            // PR is recorded server-side by pr-check; celebrate locally
            stashPrResult(pr);
            setPrBanner({ pr, machineName: exercise.machineName });
          }
        })
        .catch(() => {});

      // AI suggestion (async, non-blocking)
      if (aiEnabled) {
        computeSuggestion(machineId, exercise.machineName, result.sets);
      }
    } finally {
      setLoggingMachineId(null);
    }
  };

  // ─── Handle set feedback ───────────────────────────
  const handleSubmitFeedback = async (
    feedbackKey: string,
    feedback: SetFeedbackRating,
    bodyArea?: BodyArea,
  ) => {
    // Optimistic: mark as submitted immediately
    setFeedbackSubmitted((prev) => new Set([...prev, feedbackKey]));

    if (!identity) return;
    const [machineId, setNumberRaw] = feedbackKey.split(':');
    const setNumber = parseInt(setNumberRaw, 10);
    const exercise = exercises.find((e) => e.machineId === machineId);
    if (!exercise?.sessionId || Number.isNaN(setNumber)) return;

    try {
      await supabase.from('set_feedback').insert({
        gym_id: identity.gymId,
        profile_id: identity.userId,
        session_id: exercise.sessionId,
        set_number: setNumber,
        feedback,
        body_area: bodyArea ?? null,
        notes: null,
      });

      trackEvent('set_feedback_submitted', {
        session_id: exercise.sessionId,
        set_number: setNumber,
        feedback,
        body_area: bodyArea,
      });
    } catch {
      // Non-fatal — feedback is best-effort
    }
  };

  // ─── Add machine ────────────────────────────────────
  const handleAddMachine = (machine: { id: string; name: string }) => {
    setShowAddMachine(false);
    setExercises((prev) => {
      if (prev.some((e) => e.machineId === machine.id)) return prev;
      return [
        ...prev.filter((e) => e.completedAt == null),
        {
          machineId: machine.id,
          machineName: machine.name,
          sessionId: null,
          sets: [],
          pendingSets: [],
          totalVolumeLbs: 0,
          bestWeightLbs: 0,
          completedAt: null,
        },
        ...prev.filter((e) => e.completedAt != null),
      ];
    });
  };

  // ─── Finish workout ─────────────────────────────────
  const handleFinishWorkout = () => {
    const openSessions = exercises.filter((e) => e.sessionId && e.completedAt == null);
    if (openSessions.length === 0) {
      Alert.alert('Nothing to finish', 'Log at least one set before finishing.');
      return;
    }
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
    if (!identity) return;
    setFinishing(true);

    try {
      const openSessions = exercises.filter((e) => e.sessionId && e.completedAt == null);
      const results: CompleteSessionResult[] = [];
      let failures = 0;

      for (const e of openSessions) {
        const result = await completeSession(e.sessionId as string, identity.memberId);
        if (result) {
          results.push(result);
        } else {
          failures++;
        }
      }

      trackEvent('workout_finished', {
        session_count: openSessions.length,
        total_sets: exercises.reduce((sum, e) => sum + e.sets.length, 0),
      });

      if (failures > 0) {
        Alert.alert(
          'Partly Completed',
          `${failures} session${failures > 1 ? 's' : ''} couldn't be completed and will stay active.`,
        );
      }

      stashCompletionResults(results);
      router.replace('/workout/complete/today');
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
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Could not load workout</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadToday}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Computed enrichment values ─────────────────────
  const totalSetsLogged = exercises.reduce(
    (sum, e) => sum + e.sets.length + e.pendingSets.length,
    0,
  );
  const totalVolumeLbs = exercises.reduce(
    (sum, e) =>
      sum +
      e.totalVolumeLbs +
      e.pendingSets.reduce((pSum, s) => pSum + s.weight_lbs * s.reps, 0),
    0,
  );
  const exercisesWithSets = exercises.filter(
    (e) => e.sets.length > 0 || e.pendingSets.length > 0,
  ).length;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedDisplay = elapsedHours > 0
    ? `${elapsedHours}h ${elapsedMinutes % 60}m`
    : `${elapsedMinutes}m ${elapsedSeconds % 60}s`;

  const intentCfg = INTENT_CONFIG[sessionIntent] ?? INTENT_CONFIG.push;

  const pickerMachines = machines
    .filter((m) => !exercises.some((e) => e.machineId === m.id))
    .map((m) => ({ id: m.id, name: m.name }));

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
            <Text style={styles.title}>Today&apos;s Workout</Text>
            <Text style={styles.subtitle}>{localSessionDate()}</Text>
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

        {/* ─── PR Celebration Banner ────────────────── */}
        {prBanner && (
          <PrBanner
            banner={prBanner}
            unit={weightUnit}
            onDismiss={() => setPrBanner(null)}
          />
        )}

        {/* ─── Live Stats Strip ─────────────────────── */}
        <View style={styles.liveStatsStrip}>
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>{totalSetsLogged}</Text>
            <Text style={styles.liveStatLabel}>sets</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>
              {formatVolumeLbs(totalVolumeLbs, weightUnit)}
            </Text>
            <Text style={styles.liveStatLabel}>volume</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStatPill}>
            <Text style={styles.liveStatValue}>{exercises.length}</Text>
            <Text style={styles.liveStatLabel}>machines</Text>
          </View>
        </View>

        {/* ─── Session Progress Bar ─────────────────── */}
        {exercises.length > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                {exercisesWithSets} of {exercises.length} machines started
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
              No machines yet. Tap the + button to add one.
            </Text>
          </View>
        )}

        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.machineId}
            exercise={exercise}
            unit={weightUnit}
            onLogSet={handleLogSet}
            loggingMachineId={loggingMachineId}
            suggestion={suggestions[exercise.machineId] ?? null}
            aiEnabled={aiEnabled}
            checklist={
              checklistEnabled
                ? (() => {
                    const machine = machines.find((m) => m.id === exercise.machineId);
                    return machine ? getFormChecklist({ machine }) : null;
                  })()
                : null
            }
            checklistEnabled={checklistEnabled}
            feedbackEnabled={feedbackEnabled}
            lastLoggedSetNumber={lastLoggedSetNumbers[exercise.machineId] ?? null}
            onSubmitFeedback={handleSubmitFeedback}
            feedbackSubmitted={feedbackSubmitted}
            safetyNudge={safetyNudges[exercise.machineId] ?? null}
          />
        ))}

        <TouchableOpacity
          style={[styles.finishButton, finishing && styles.finishButtonDisabled]}
          onPress={handleFinishWorkout}
          disabled={finishing}
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
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

      {/* Floating Add Machine Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddMachine(true)}
        accessibilityRole="button"
        accessibilityLabel="Add machine to workout"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Machine Modal */}
      <AddMachineModal
        visible={showAddMachine}
        onClose={() => setShowAddMachine(false)}
        onAdd={handleAddMachine}
        machines={pickerMachines}
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
  // PR banner — crimson base with gold accent (celebration moment)
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '59',
    padding: 14,
    marginBottom: 12,
    gap: 10,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  prBannerTrophy: {
    fontSize: 24,
  },
  prBannerBody: {
    flex: 1,
  },
  prBannerTitle: {
    fontSize: 12,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  prBannerText: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
  prBannerDismiss: {
    padding: 6,
  },
  prBannerDismissText: {
    fontSize: 14,
    color: colors.textSecondary,
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
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exerciseName: {
    flex: 1,
    fontSize: 20,
    fontFamily: typography.fontBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  doneChip: {
    backgroundColor: colors.successSubtle,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  doneChipText: {
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  setQueued: {
    flex: 1,
    fontSize: 11,
    fontFamily: typography.fontSemiBold,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'center',
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
  machineList: {
    maxHeight: 320,
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
  machineItemText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.text,
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
