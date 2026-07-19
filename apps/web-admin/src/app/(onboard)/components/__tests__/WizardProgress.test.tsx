/**
 * Tests for WizardProgress component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { WizardProgress } from '../WizardProgress';

describe('WizardProgress', () => {
  it('renders 4 step labels', () => {
    render(<WizardProgress currentStep={1} />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Setup')).toBeInTheDocument();
  });

  it('marks current step with aria-current="step"', () => {
    const { container } = render(<WizardProgress currentStep={2} />);
    // The dot for step 2 has aria-current="step"
    const activeEl = container.querySelector('[aria-current="step"]');
    expect(activeEl).not.toBeNull();
  });

  it('shows sr-only text indicating current step', () => {
    render(<WizardProgress currentStep={3} />);
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
  });

  it('step 1 active: Account dot has aria-current, others do not', () => {
    const { container } = render(<WizardProgress currentStep={1} />);
    const ariaCurrentEls = container.querySelectorAll('[aria-current="step"]');
    expect(ariaCurrentEls).toHaveLength(1);
    expect(ariaCurrentEls[0]).toHaveAttribute('aria-label', expect.stringContaining('Step 1'));
  });

  it('step 4 active: Setup dot is current, steps 1-3 are completed', () => {
    const { container } = render(<WizardProgress currentStep={4} />);
    const ariaCurrentEls = container.querySelectorAll('[aria-current="step"]');
    expect(ariaCurrentEls).toHaveLength(1);
    expect(ariaCurrentEls[0]).toHaveAttribute('aria-label', expect.stringContaining('Step 4'));
  });
});
