/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressiveSetForm } from '../ProgressiveSetForm';

jest.mock('@/lib/ui/haptics', () => ({
  haptics: { light: jest.fn(), success: jest.fn() },
}));

const baseProps = {
  targetReps: null,
  setNumber: 1,
  previousSets: [],
  loading: false,
  machineName: 'Leg Press',
  onSetLogged: jest.fn().mockResolvedValue({}),
  onDone: jest.fn(),
};

// Helper: build a valid NextSetSuggestion with a real ReasonCode.
function mkSuggestion(weightLbs: number, reps: number, reasonText = '') {
  return {
    suggested_weight: weightLbs,
    suggested_reps: reps,
    suggested_rpe: null,
    confidence: 0.8,
    reason_code: 'INCREASE_SMALL' as const,
    reason_text: reasonText,
    should_suggest_increase: true,
  };
}

/**
 * RollingNumber renders the current value across multiple `.number-value`
 * spans (prev + current for the roll animation). Exact text queries like
 * `getByText('82.5')` can miss because of that. Mirror RollingNumber.test.tsx
 * and check the collected text content of `.number-value` nodes.
 */
function collectNumberValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.number-value')).map(
    (el) => el.textContent ?? ''
  );
}

describe('ProgressiveSetForm — kg refactor', () => {
  test('displays lbs suggestion in lbs when unit=lbs', () => {
    const { container } = render(
      <ProgressiveSetForm
        {...baseProps}
        suggestion={mkSuggestion(185, 8, 'Nice progression')}
        targetReps={8}
        weightIncrement={5}
        weightUnit="lbs"
      />
    );
    expect(collectNumberValues(container)).toContain('185');
    // Unit label somewhere in the stepper
    expect(screen.getAllByText('lbs').length).toBeGreaterThan(0);
    // Stepper aria-labels include lbs + correct step
    expect(
      screen.getByRole('button', { name: /Increase lbs by 5/ })
    ).toBeTruthy();
  });

  test('converts lbs suggestion to kg and snaps to kg increment when unit=kg', () => {
    const { container } = render(
      <ProgressiveSetForm
        {...baseProps}
        // 185 lbs × 0.45359237 = 83.9146 kg
        //   floor(/2.5)*2.5 = 82.5  (distance 1.4146)
        //   ceil (/2.5)*2.5 = 85.0  (distance 1.0854)  ← nearest
        suggestion={mkSuggestion(185, 8, 'Nice progression')}
        targetReps={8}
        weightIncrement={2.5}
        weightUnit="kg"
      />
    );
    expect(collectNumberValues(container)).toContain('85');
    expect(screen.getAllByText('kg').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: /Increase kg by 2\.5/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Decrease kg by 2\.5/ })
    ).toBeTruthy();
  });

  test('snaps a whole-kg suggestion to integer value with no decimal', () => {
    // 220 lbs → 99.79 kg → snap to 100 (nearest 2.5).
    const { container } = render(
      <ProgressiveSetForm
        {...baseProps}
        suggestion={mkSuggestion(220, 8)}
        targetReps={8}
        weightIncrement={2.5}
        weightUnit="kg"
      />
    );
    expect(collectNumberValues(container)).toContain('100');
  });

  test('previous sets render converted to kg when unit=kg', () => {
    render(
      <ProgressiveSetForm
        {...baseProps}
        previousSets={[{ set_number: 1, weight_lbs: 220, reps: 8, rpe: 7 }]}
        suggestion={null}
        targetReps={8}
        weightIncrement={2.5}
        weightUnit="kg"
      />
    );
    // 220 lbs → 99.79 kg → snap to 100 kg
    expect(screen.getByText(/100\s*kg/)).toBeTruthy();
  });

  test('previous sets render in lbs when unit=lbs', () => {
    render(
      <ProgressiveSetForm
        {...baseProps}
        previousSets={[{ set_number: 1, weight_lbs: 185, reps: 8, rpe: 7 }]}
        suggestion={null}
        targetReps={8}
        weightIncrement={5}
        weightUnit="lbs"
      />
    );
    expect(screen.getByText(/185\s*lbs/)).toBeTruthy();
  });
});
