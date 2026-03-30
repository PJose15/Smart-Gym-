import {
  setLogReducer,
  createInitialState,
  type SetLogState,
  type SetLogAction,
} from '../setLogStateMachine';

function reduce(state: SetLogState, ...actions: SetLogAction[]): SetLogState {
  return actions.reduce(setLogReducer, state);
}

describe('setLogStateMachine', () => {
  const initial = createInitialState(100, 10);

  // Test 1: Initial state is 'weight' step
  test('initial state starts on weight step', () => {
    expect(initial.step).toBe('weight');
    expect(initial.weight).toBe(100);
    expect(initial.reps).toBe(10);
    expect(initial.rpe).toBeNull();
    expect(initial.isSubmitting).toBe(false);
    expect(initial.error).toBeNull();
  });

  // Test 2: Cannot advance to reps with weight = 0
  test('ADVANCE_TO_REPS blocked when weight is 0', () => {
    const zeroWeight = createInitialState(0, 10);
    const next = setLogReducer(zeroWeight, { type: 'ADVANCE_TO_REPS' });
    expect(next.step).toBe('weight');
  });

  // Test 3: ADVANCE_TO_REPS moves to reps step
  test('ADVANCE_TO_REPS advances to reps when weight > 0', () => {
    const next = setLogReducer(initial, { type: 'ADVANCE_TO_REPS' });
    expect(next.step).toBe('reps');
  });

  // Test 4: ADVANCE_TO_RPE moves to rpe step
  test('ADVANCE_TO_RPE advances to rpe when reps > 0', () => {
    const atReps = reduce(initial, { type: 'ADVANCE_TO_REPS' });
    const next = setLogReducer(atReps, { type: 'ADVANCE_TO_RPE' });
    expect(next.step).toBe('rpe');
  });

  // Test 4b: Cannot advance to RPE with reps = 0
  test('ADVANCE_TO_RPE blocked when reps is 0', () => {
    const atReps = reduce(initial, { type: 'ADVANCE_TO_REPS' }, { type: 'SET_REPS', reps: 0 });
    const next = setLogReducer(atReps, { type: 'ADVANCE_TO_RPE' });
    expect(next.step).toBe('reps');
  });

  // Test 5: SKIP_RPE moves to confirm with rpe = null and rpeSkipped = true
  test('SKIP_RPE moves to confirm with rpe null and rpeSkipped true', () => {
    const atRpe = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' }
    );
    const next = setLogReducer(atRpe, { type: 'SKIP_RPE' });
    expect(next.step).toBe('confirm');
    expect(next.rpe).toBeNull();
    expect(next.rpeSkipped).toBe(true);
  });

  // Test 6: SET_RPE moves to confirm with rpe value and rpeSkipped = false
  test('SET_RPE moves to confirm with rpe value and rpeSkipped false', () => {
    const atRpe = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' }
    );
    const next = setLogReducer(atRpe, { type: 'SET_RPE', rpe: 8 });
    expect(next.step).toBe('confirm');
    expect(next.rpe).toBe(8);
    expect(next.rpeSkipped).toBe(false);
  });

  // Test 7: RESET returns to weight step with new values
  test('RESET returns to weight step with new values', () => {
    const submitted = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SET_RPE', rpe: 7 },
      { type: 'SUBMITTING' }
    );
    const next = setLogReducer(submitted, { type: 'RESET', nextWeight: 105, nextReps: 10 });
    expect(next.step).toBe('weight');
    expect(next.weight).toBe(105);
    expect(next.reps).toBe(10);
    expect(next.rpe).toBeNull();
    expect(next.isSubmitting).toBe(false);
    expect(next.error).toBeNull();
  });

  // Test 8: ERROR sets error message, clears isSubmitting
  test('ERROR sets message and clears isSubmitting', () => {
    const submitting = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SKIP_RPE' },
      { type: 'SUBMITTING' }
    );
    expect(submitting.isSubmitting).toBe(true);

    const next = setLogReducer(submitting, { type: 'ERROR', message: 'Network error' });
    expect(next.isSubmitting).toBe(false);
    expect(next.error).toBe('Network error');
  });

  // Test 9: SET_WEIGHT updates weight
  test('SET_WEIGHT updates weight value', () => {
    const next = setLogReducer(initial, { type: 'SET_WEIGHT', weight: 135 });
    expect(next.weight).toBe(135);
    expect(next.step).toBe('weight'); // stays on same step
  });

  // Test 10: SET_REPS updates reps
  test('SET_REPS updates reps value', () => {
    const atReps = reduce(initial, { type: 'ADVANCE_TO_REPS' });
    const next = setLogReducer(atReps, { type: 'SET_REPS', reps: 12 });
    expect(next.reps).toBe(12);
  });

  // Test 11: SUBMITTING sets flag
  test('SUBMITTING sets isSubmitting and clears error', () => {
    const withError = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SKIP_RPE' },
      { type: 'ERROR', message: 'fail' }
    );
    expect(withError.error).toBe('fail');

    const next = setLogReducer(withError, { type: 'SUBMITTING' });
    expect(next.isSubmitting).toBe(true);
    expect(next.error).toBeNull();
  });

  // Test 12: GO_BACK navigates backwards
  test('GO_BACK navigates to previous step', () => {
    expect(setLogReducer(initial, { type: 'GO_BACK' }).step).toBe('weight'); // no-op at first step

    const atReps = reduce(initial, { type: 'ADVANCE_TO_REPS' });
    expect(setLogReducer(atReps, { type: 'GO_BACK' }).step).toBe('weight');

    const atRpe = reduce(atReps, { type: 'ADVANCE_TO_RPE' });
    expect(setLogReducer(atRpe, { type: 'GO_BACK' }).step).toBe('reps');

    const atConfirm = reduce(atRpe, { type: 'SET_RPE', rpe: 8 });
    expect(setLogReducer(atConfirm, { type: 'GO_BACK' }).step).toBe('rpe');
  });

  // Test 12b: GO_BACK from confirm goes to reps when RPE was skipped
  test('GO_BACK from confirm goes to reps when RPE was skipped', () => {
    const skippedRpe = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SKIP_RPE' }
    );
    expect(skippedRpe.step).toBe('confirm');
    expect(skippedRpe.rpeSkipped).toBe(true);

    const back = setLogReducer(skippedRpe, { type: 'GO_BACK' });
    expect(back.step).toBe('reps'); // goes to reps, not rpe
  });

  // Test 12c: GO_BACK from confirm goes to rpe when RPE was set
  test('GO_BACK from confirm goes to rpe when RPE was set', () => {
    const setRpe = reduce(
      initial,
      { type: 'ADVANCE_TO_REPS' },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SET_RPE', rpe: 8 }
    );
    expect(setRpe.step).toBe('confirm');
    expect(setRpe.rpeSkipped).toBe(false);

    const back = setLogReducer(setRpe, { type: 'GO_BACK' });
    expect(back.step).toBe('rpe'); // goes to rpe
  });

  // Test 13: createInitialState factory
  test('createInitialState sets suggested weight and target reps', () => {
    const state = createInitialState(225, 5);
    expect(state.weight).toBe(225);
    expect(state.reps).toBe(5);
    expect(state.step).toBe('weight');
  });

  // Test 14: Full happy path flow
  test('full flow: weight → reps → rpe → confirm', () => {
    const result = reduce(
      initial,
      { type: 'SET_WEIGHT', weight: 135 },
      { type: 'ADVANCE_TO_REPS' },
      { type: 'SET_REPS', reps: 8 },
      { type: 'ADVANCE_TO_RPE' },
      { type: 'SET_RPE', rpe: 7 }
    );
    expect(result.step).toBe('confirm');
    expect(result.weight).toBe(135);
    expect(result.reps).toBe(8);
    expect(result.rpe).toBe(7);
  });
});
