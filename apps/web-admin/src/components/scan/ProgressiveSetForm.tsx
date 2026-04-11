'use client';

import { useReducer, useEffect, useCallback, useRef, useState, useMemo } from 'react';
import type { NextSetSuggestion } from '@nexera/types';
import { setLogReducer, createInitialState, type SetLogStep } from '@/lib/scan/setLogStateMachine';
import { haptics } from '@/lib/ui/haptics';
import { convertFromLbs, convertToLbs, type WeightUnit } from '@/lib/weight';
import { RollingNumber } from './RollingNumber';
import { StepDot } from './StepDot';

// ── Types ────────────────────────────────────────────────────

interface PreviousSet {
  set_number: number;
  weight_lbs: number;
  reps: number;
  rpe: number | null;
}

interface ProgressiveSetFormProps {
  suggestion: NextSetSuggestion | null;
  targetReps: number | null;
  onSetLogged: (set: {
    weight_lbs: number;
    reps: number;
    rpe: number | null;
  }) => Promise<unknown>;
  setNumber: number;
  previousSets: PreviousSet[];
  /** Step size in the *display* unit (e.g. 5 lbs or 2.5 kg). */
  weightIncrement: number;
  loading: boolean;
  onDone: () => void;
  machineName: string;
  /** Member's preferred weight unit. Storage remains lbs regardless. */
  weightUnit?: WeightUnit;
}

// ── RPE options (6–10 scale) ─────────────────────────────────

const RPE_OPTIONS = [
  { value: 6, label: '6', description: 'Easy' },
  { value: 7, label: '7', description: 'Moderate' },
  { value: 8, label: '8', description: 'Hard' },
  { value: 9, label: '9', description: 'Very Hard' },
  { value: 10, label: '10', description: 'Max' },
];

// ── Helpers ──────────────────────────────────────────────────

/**
 * Snap an lbs value to a clean display-unit increment. Both the input
 * suggestion and previous-set totals live in lbs storage format, so
 * converting straight to kg gives odd values (e.g. 185 lbs → 83.9146 kg).
 * Rounding to the nearest step on the display-unit grid keeps the stepper
 * aligned with plate reality (2.5 / 5 kg or 5 / 10 lbs).
 */
function lbsToDisplayStep(lbs: number, unit: WeightUnit, step: number): number {
  const value = convertFromLbs(lbs, unit);
  if (step <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / step) * step;
}

/** Format a display-unit value for inline text (no unit suffix). */
function formatDisplay(value: number, unit: WeightUnit): string {
  if (unit === 'kg') {
    // kg keeps one decimal when fractional, integer otherwise
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}

// ── Component ────────────────────────────────────────────────

export function ProgressiveSetForm({
  suggestion,
  targetReps,
  onSetLogged,
  setNumber,
  previousSets,
  weightIncrement,
  loading,
  onDone,
  machineName,
  weightUnit = 'lbs',
}: ProgressiveSetFormProps) {
  const initialWeightLbs = suggestion?.suggested_weight ?? 0;
  const initialWeight = lbsToDisplayStep(initialWeightLbs, weightUnit, weightIncrement);
  const initialReps = targetReps ?? suggestion?.suggested_reps ?? 10;

  const [state, dispatch] = useReducer(
    setLogReducer,
    createInitialState(initialWeight, initialReps)
  );

  // Animation key — increments on step change to trigger CSS animation
  const [animKey, setAnimKey] = useState(0);
  const prevStep = useRef(state.step);

  useEffect(() => {
    if (state.step !== prevStep.current) {
      setAnimKey((k) => k + 1);
      prevStep.current = state.step;
    }
  }, [state.step]);

  // Auto-advance: when reps match program target, advance after 1.5s
  useEffect(() => {
    if (state.step !== 'reps') return;
    if (targetReps === null) return;
    if (state.reps !== targetReps) return;

    const timer = setTimeout(() => {
      dispatch({ type: 'ADVANCE_TO_RPE' });
      haptics.light();
    }, 1500);

    return () => clearTimeout(timer);
  }, [state.step, state.reps, targetReps]);

  // Apply suggestion when it changes (for 2nd+ sets)
  const appliedSuggestionRef = useRef(0);
  useEffect(() => {
    if (!suggestion || setNumber <= 1) return;
    if (appliedSuggestionRef.current === setNumber) return;
    appliedSuggestionRef.current = setNumber;

    if (suggestion.suggested_weight !== null) {
      dispatch({
        type: 'SET_WEIGHT',
        weight: lbsToDisplayStep(suggestion.suggested_weight, weightUnit, weightIncrement),
      });
    }
    if (suggestion.suggested_reps !== null) {
      dispatch({ type: 'SET_REPS', reps: suggestion.suggested_reps });
    }
  }, [suggestion, setNumber, weightUnit, weightIncrement]);

  const handleConfirm = useCallback(async () => {
    dispatch({ type: 'SUBMITTING' });
    haptics.light();

    // Convert display-unit → lbs at the submit boundary. Storage is always lbs.
    const weightLbs = convertToLbs(state.weight, weightUnit);

    try {
      await onSetLogged({
        weight_lbs: weightLbs,
        reps: state.reps,
        rpe: state.rpe,
      });

      // Reset for next set — keep last weight, restore target reps
      dispatch({
        type: 'RESET',
        nextWeight: state.weight,
        nextReps: targetReps ?? state.reps,
      });
    } catch {
      dispatch({
        type: 'ERROR',
        message: 'Set could not be saved. Try again.',
      });
    }
  }, [onSetLogged, state.weight, state.reps, state.rpe, targetReps, weightUnit]);

  // Project the lbs-native suggestion into display-unit space so RollingNumber
  // can highlight the suggested-weight dot correctly.
  const displaySuggestion = useMemo(() => {
    if (!suggestion || suggestion.suggested_weight === null) return null;
    return {
      suggested_weight: lbsToDisplayStep(suggestion.suggested_weight, weightUnit, weightIncrement),
    };
  }, [suggestion, weightUnit, weightIncrement]);

  // Max weight clamps for the stepper. Hard cap stays the same in lbs (1500);
  // in kg it's ~680. RollingNumber's default max is 9999 which is effectively
  // unbounded for kg, so we set a sane ceiling.
  const maxWeight = weightUnit === 'kg' ? 700 : 1500;

  return (
    <div className="progressive-form">
      {/* Step indicator */}
      <div className="step-indicator" role="progressbar" aria-valuenow={stepIndex(state.step)} aria-valuemin={0} aria-valuemax={3} aria-valuetext={stepLabel(state.step)}>
        <StepDot
          active={state.step === 'weight'}
          complete={['reps', 'rpe', 'confirm'].includes(state.step)}
        />
        <StepDot
          active={state.step === 'reps'}
          complete={['rpe', 'confirm'].includes(state.step)}
        />
        <StepDot
          active={state.step === 'rpe'}
          complete={state.step === 'confirm'}
        />
      </div>

      {/* Animated step content */}
      <div key={animKey} className="progressive-step-enter">
        {/* STEP 1: WEIGHT */}
        {state.step === 'weight' && (
          <div className="form-step">
            <div className="step-label">Weight</div>
            <RollingNumber
              value={state.weight}
              onChange={(w) => dispatch({ type: 'SET_WEIGHT', weight: w })}
              unit={weightUnit}
              step={weightIncrement}
              max={maxWeight}
              suggestion={displaySuggestion}
            />
            {suggestion?.reason_text &&
              suggestion.reason_code !== 'INSUFFICIENT_DATA' && (
                <div className="suggestion-hint">{suggestion.reason_text}</div>
              )}
            <button
              type="button"
              className="pf-btn pf-btn-primary"
              onClick={() => {
                dispatch({ type: 'ADVANCE_TO_REPS' });
                haptics.light();
              }}
              disabled={state.weight <= 0}
            >
              Next
            </button>
          </div>
        )}

        {/* STEP 2: REPS */}
        {state.step === 'reps' && (
          <div className="form-step">
            <div className="step-label">
              {formatDisplay(state.weight, weightUnit)} {weightUnit} &middot; Reps
            </div>
            <RollingNumber
              value={state.reps}
              onChange={(r) => dispatch({ type: 'SET_REPS', reps: r })}
              unit="reps"
              step={1}
              min={1}
              max={100}
            />
            {targetReps !== null && (
              <div className="target-hint">Target: {targetReps} reps</div>
            )}
            <div className="form-step-actions">
              <button
                type="button"
                className="pf-btn pf-btn-ghost"
                onClick={() => dispatch({ type: 'GO_BACK' })}
                aria-label="Back to weight step"
              >
                Back
              </button>
              <button
                type="button"
                className="pf-btn pf-btn-primary"
                onClick={() => {
                  dispatch({ type: 'ADVANCE_TO_RPE' });
                  haptics.light();
                }}
                disabled={state.reps <= 0}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RPE (OPTIONAL) */}
        {state.step === 'rpe' && (
          <div className="form-step">
            <div className="step-label">How hard? (optional)</div>
            <div className="rpe-hint">6 = easy &middot; 10 = max effort</div>
            <div className="rpe-grid">
              {RPE_OPTIONS.map((opt) => {
                const isSelected = state.rpe === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rpe-chip ${isSelected ? 'rpe-chip-selected' : ''}`}
                    title={`RPE ${opt.value}: ${opt.description}`}
                    onClick={() => {
                      dispatch({ type: 'SET_RPE', rpe: opt.value });
                      haptics.light();
                    }}
                    aria-label={`RPE ${opt.value}: ${opt.description}`}
                    aria-pressed={isSelected}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="form-step-actions">
              <button
                type="button"
                className="pf-btn pf-btn-ghost"
                onClick={() => dispatch({ type: 'GO_BACK' })}
                aria-label="Back to reps step"
              >
                Back
              </button>
              <button
                type="button"
                className="pf-btn pf-btn-ghost"
                onClick={() => {
                  dispatch({ type: 'SKIP_RPE' });
                  haptics.light();
                }}
                aria-label="Skip effort rating"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CONFIRM */}
        {state.step === 'confirm' && (
          <div className="form-step">
            <div className="set-summary-preview">
              <span className="summary-weight">
                {formatDisplay(state.weight, weightUnit)} {weightUnit}
              </span>
              <span className="summary-divider">&times;</span>
              <span className="summary-reps">{state.reps} reps</span>
              {state.rpe !== null && (
                <span className="summary-rpe">&middot; RPE {state.rpe}</span>
              )}
            </div>
            <button
              type="button"
              className="pf-btn pf-btn-primary"
              onClick={handleConfirm}
              disabled={state.isSubmitting || loading}
            >
              {state.isSubmitting ? 'Logging...' : `Log Set ${setNumber}`}
            </button>
            {state.error && (
              <div className="form-error" role="alert">
                {state.error}
              </div>
            )}
            <button
              type="button"
              className="pf-btn pf-btn-ghost"
              onClick={() => dispatch({ type: 'GO_BACK' })}
              disabled={state.isSubmitting}
              aria-label="Edit set details"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Logged sets history — always rendered in member's display unit */}
      {previousSets.length > 0 && (
        <div className="previous-sets">
          {previousSets.map((s) => (
            <div key={s.set_number} className="previous-set-row">
              <div className="previous-set-num">{s.set_number}</div>
              <div className="previous-set-detail">
                <span className="previous-set-weight">
                  {formatDisplay(
                    lbsToDisplayStep(s.weight_lbs, weightUnit, weightIncrement),
                    weightUnit
                  )}{' '}
                  {weightUnit}
                </span>
                <span className="previous-set-x">&times;</span>
                <span className="previous-set-reps">{s.reps}</span>
              </div>
              {s.rpe !== null && (
                <span className="previous-set-rpe">RPE {s.rpe}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Done button — only after at least 1 set logged */}
      {previousSets.length > 0 && (
        <button
          type="button"
          className="pf-btn pf-btn-outline"
          onClick={onDone}
          disabled={loading || state.isSubmitting}
        >
          Done with {machineName}
        </button>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function stepIndex(step: SetLogStep): number {
  const map: Record<SetLogStep, number> = { weight: 0, reps: 1, rpe: 2, confirm: 3 };
  return map[step];
}

function stepLabel(step: SetLogStep): string {
  const labels: Record<SetLogStep, string> = {
    weight: 'Step 1 of 4: Weight',
    reps: 'Step 2 of 4: Reps',
    rpe: 'Step 3 of 4: Effort',
    confirm: 'Step 4 of 4: Review',
  };
  return labels[step];
}
