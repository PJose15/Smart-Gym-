/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MachineForm, type MachineFormValues } from '../MachineForm';

function renderForm(overrides: Partial<React.ComponentProps<typeof MachineForm>> = {}) {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const props = {
    onSubmit,
    ...overrides,
  };
  const result = render(<MachineForm {...props} />);
  return { ...result, onSubmit };
}

// T1: minimal mode hides movement pattern, difficulty, setup steps
test('minimal mode hides movement pattern and difficulty and setup steps', () => {
  renderForm({ minimal: true });

  expect(screen.queryByLabelText(/movement pattern/i)).toBeNull();
  expect(screen.queryByLabelText(/difficulty/i)).toBeNull();
  expect(screen.queryByLabelText(/setup steps/i)).toBeNull();
  expect(screen.queryByLabelText(/safety cues/i)).toBeNull();
});

// T2: full mode shows all fields
test('full mode shows all fields', () => {
  renderForm({ minimal: false });

  expect(screen.getByLabelText(/movement pattern/i)).toBeTruthy();
  expect(screen.getByLabelText(/difficulty/i)).toBeTruthy();
  expect(screen.getByLabelText(/setup steps/i)).toBeTruthy();
  expect(screen.getByLabelText(/safety cues/i)).toBeTruthy();
});

// T3: submitting with name + one muscle calls onSubmit with correct values
test('submitting with name and one muscle calls onSubmit correctly', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(<MachineForm onSubmit={onSubmit} />);

  // Fill in name
  const nameInput = screen.getByLabelText(/machine name/i);
  fireEvent.change(nameInput, { target: { value: 'Lat Pulldown' } });

  // Select a muscle chip
  const latsChip = screen.getByRole('checkbox', { name: 'lats' });
  fireEvent.click(latsChip);

  // Submit the form
  const submitBtn = screen.getByRole('button', { name: /add machine/i });
  fireEvent.click(submitBtn);

  // Wait for async onSubmit
  await Promise.resolve();

  expect(onSubmit).toHaveBeenCalledTimes(1);
  const values: MachineFormValues = onSubmit.mock.calls[0][0];
  expect(values.name).toBe('Lat Pulldown');
  expect(values.target_muscles).toContain('lats');
  expect(values.equipment_type).toBe('machine'); // default
});

// T4: submit disabled while submitting prop is true
test('submit button is disabled when submitting prop is true', () => {
  renderForm({ submitting: true });

  const submitBtn = screen.getByRole('button', { name: /adding\.\.\./i }) as HTMLButtonElement;
  expect(submitBtn.disabled).toBe(true);
});
