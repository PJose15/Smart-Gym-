// ── Progressive Set Log State Machine ────────────────────────
// 4-step form: weight → reps → rpe → confirm
// Pure reducer — no side effects, fully testable

export type SetLogStep = 'weight' | 'reps' | 'rpe' | 'confirm';

export interface SetLogState {
  step: SetLogStep;
  weight: number;
  reps: number;
  rpe: number | null;
  rpeSkipped: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export type SetLogAction =
  | { type: 'SET_WEIGHT'; weight: number }
  | { type: 'ADVANCE_TO_REPS' }
  | { type: 'SET_REPS'; reps: number }
  | { type: 'ADVANCE_TO_RPE' }
  | { type: 'SET_RPE'; rpe: number }
  | { type: 'SKIP_RPE' }
  | { type: 'SUBMITTING' }
  | { type: 'RESET'; nextWeight: number; nextReps: number }
  | { type: 'ERROR'; message: string }
  | { type: 'GO_BACK' };

export function setLogReducer(
  state: SetLogState,
  action: SetLogAction
): SetLogState {
  switch (action.type) {
    case 'SET_WEIGHT':
      return { ...state, weight: action.weight };

    case 'ADVANCE_TO_REPS':
      if (state.weight <= 0) return state; // guard
      return { ...state, step: 'reps' };

    case 'SET_REPS':
      return { ...state, reps: action.reps };

    case 'ADVANCE_TO_RPE':
      if (state.reps <= 0) return state; // guard
      return { ...state, step: 'rpe' };

    case 'SET_RPE':
      return { ...state, rpe: action.rpe, rpeSkipped: false, step: 'confirm' };

    case 'SKIP_RPE':
      return { ...state, rpe: null, rpeSkipped: true, step: 'confirm' };

    case 'SUBMITTING':
      return { ...state, isSubmitting: true, error: null };

    case 'RESET':
      return {
        step: 'weight',
        weight: action.nextWeight,
        reps: action.nextReps,
        rpe: null,
        rpeSkipped: false,
        isSubmitting: false,
        error: null,
      };

    case 'ERROR':
      return { ...state, isSubmitting: false, error: action.message };

    case 'GO_BACK': {
      // From confirm: go to reps if RPE was skipped, otherwise rpe
      if (state.step === 'confirm') {
        return { ...state, step: state.rpeSkipped ? 'reps' : 'rpe' };
      }
      const BACK_MAP: Record<string, SetLogStep> = {
        weight: 'weight',
        reps: 'weight',
        rpe: 'reps',
      };
      return { ...state, step: BACK_MAP[state.step] ?? state.step };
    }

    default:
      return state;
  }
}

export function createInitialState(
  suggestedWeight: number,
  targetReps: number
): SetLogState {
  return {
    step: 'weight',
    weight: suggestedWeight,
    reps: targetReps,
    rpe: null,
    rpeSkipped: false,
    isSubmitting: false,
    error: null,
  };
}
