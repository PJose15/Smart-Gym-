'use client';

import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import type { NextSetSuggestion } from '@nexera/types';
import { setLogReducer, createInitialState, type SetLogStep } from '@/lib/scan/setLogStateMachine';
import { haptics } from '@/lib/ui/haptics';
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
  weightIncrement: number;
  loading: boolean;
  onDone: () => void;
  machineName: string;
}

// ── RPE options (6–10 scale) ─────────────────────────────────

const RPE_OPTIONS = [
  { value: 6, label: '6', description: 'Easy' },
  { value: 7, label: '7', description: 'Moderate' },
  { value: 8, label: '8', description: 'Hard' },
  { value: 9, label: '9', description: 'Very Hard' },
  { value: 10, label: '10', description: 'Max' },
];

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
}: ProgressiveSetFormProps) {
  const initialWeight = suggestion?.suggested_weight ?? 0;
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
      dispatch({ type: 'SET_WEIGHT', weight: suggestion.suggested_weight });
    }
    if (suggestion.suggested_reps !== null) {
      dispatch({ type: 'SET_REPS', reps: suggestion.suggested_reps });
    }
  }, [suggestion, setNumber]);

  const handleConfirm = useCallback(async () => {
    dispatch({ type: 'SUBMITTING' });
    haptics.light();

    try {
      await onSetLogged({
        weight_lbs: state.weight,
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
  }, [onSetLogged, state.weight, state.reps, state.rpe, targetReps]);

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
              unit="lbs"
              step={weightIncrement}
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
              {state.weight} lbs &middot; Reps
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
              <span className="summary-weight">{state.weight} lbs</span>
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
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Logged sets history */}
      {previousSets.length > 0 && (
        <div className="previous-sets">
          {previousSets.map((s) => (
            <div key={s.set_number} className="previous-set-row">
              <div className="previous-set-num">{s.set_number}</div>
              <div className="previous-set-detail">
                <span className="previous-set-weight">{s.weight_lbs} lbs</span>
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
          className="pf-btn pf-btn-outline pf-btn-done"
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
