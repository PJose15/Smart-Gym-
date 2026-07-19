/**
 * @jest-environment jsdom
 */
/* Tests for the /setup wizard page (01-07) */
import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import SetupPage from '../page';

// ── Next.js navigation mocks ──────────────────────────────

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

// ── MachineForm mock ──────────────────────────────────────

jest.mock('@/components/machines/MachineForm', () => ({
  MachineForm: ({
    onSubmit,
    error,
    submitting,
    submitLabel,
  }: {
    onSubmit: (values: { name: string; target_muscles: string[]; movement_pattern: string; equipment_type: string; difficulty: string; setup_steps: string[]; safety_cues: string[] }) => void;
    error?: string | null;
    submitting?: boolean;
    submitLabel?: string;
  }) => (
    <div data-testid="machine-form-mock">
      {error && <div data-testid="form-error" role="alert">{error}</div>}
      {submitting && <span data-testid="submitting-indicator">submitting</span>}
      <button
        data-testid="submit-machine"
        onClick={() =>
          onSubmit({
            name: 'Lat Pulldown',
            target_muscles: ['lats'],
            movement_pattern: 'pull',
            equipment_type: 'machine',
            difficulty: 'beginner',
            setup_steps: [],
            safety_cues: [],
          })
        }
      >
        {submitLabel ?? 'Submit'}
      </button>
    </div>
  ),
}));

// ── WizardProgress mock ───────────────────────────────────

jest.mock('../../components/WizardProgress', () => ({
  WizardProgress: ({ currentStep }: { currentStep: number }) => (
    <div data-testid="wizard-progress" data-step={currentStep} />
  ),
}));

// ── Helpers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useSearchParams } = require('next/navigation') as { useSearchParams: jest.Mock };

function setupSearchParams(params: Record<string, string | null> = {}) {
  useSearchParams.mockReturnValue({
    get: (key: string) => params[key] ?? null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
  setupSearchParams();
});

// ─────────────────────────────────────────────────────────
// Test 1: 401 from /api/onboard/status → sign-in prompt, no form
// ─────────────────────────────────────────────────────────

test('T1: 401 from /api/onboard/status renders sign-in prompt, no machine form', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 401,
    ok: false,
    json: async () => ({ error: 'Unauthorized' }),
  });

  await act(async () => {
    render(<SetupPage />);
  });

  // Sign-in prompt visible
  expect(screen.getByTestId('sign-in-prompt')).toBeInTheDocument();

  // Sign-in link points to /staff/login?next=/setup
  const link = screen.getByRole('link', { name: /sign in/i });
  expect(link).toHaveAttribute('href', '/staff/login?next=/setup');

  // Machine form not rendered
  expect(screen.queryByTestId('machine-form-mock')).not.toBeInTheDocument();
});

// ─────────────────────────────────────────────────────────
// Test 2: happy path — status ok → submit form → POST /api/machines → QR step
// ─────────────────────────────────────────────────────────

test('T2: happy path — status ok → form submit → POST machines → QR step shows name + scan URL + pdf link', async () => {
  // Mock /api/onboard/status success
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({
      gym_id: 'gym-1',
      gym_name: 'Iron Society',
      billing: { has_subscription: true },
    }),
  });

  let rendered: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(<SetupPage />);
  });

  // Machine form visible
  expect(screen.getByTestId('machine-form-mock')).toBeInTheDocument();

  // Mock POST /api/machines 201
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 201,
    ok: true,
    json: async () => ({
      id: 'machine-abc',
      name: 'Lat Pulldown',
      qr_slug: 'lat-pulldown-x7z',
    }),
  });

  // Submit the form
  await act(async () => {
    fireEvent.click(screen.getByTestId('submit-machine'));
  });

  // Verify POST /api/machines was called with entered data
  const postCall = (global.fetch as jest.Mock).mock.calls.find(
    (c: string[]) => c[0] === '/api/machines'
  );
  expect(postCall).toBeDefined();
  expect(postCall![1].method).toBe('POST');
  const body = JSON.parse(postCall![1].body as string);
  expect(body.name).toBe('Lat Pulldown');
  expect(body.target_muscles).toContain('lats');

  // QR-ready step: machine name displayed
  expect(screen.getByTestId('machine-name')).toHaveTextContent('Lat Pulldown is live!');

  // Scan URL contains qr_slug
  const scanUrlEl = screen.getByTestId('scan-url');
  expect(scanUrlEl.textContent).toContain('lat-pulldown-x7z');

  // PDF download link href is /api/machines/qr-pdf
  const pdfLink = screen.getByTestId('qr-pdf-link');
  expect(pdfLink).toHaveAttribute('href', '/api/machines/qr-pdf');
  expect(pdfLink).toHaveAttribute('download');
});

// ─────────────────────────────────────────────────────────
// Test 3: POST failure (500) → form re-rendered with error message
// ─────────────────────────────────────────────────────────

test('T3: POST /api/machines failure → form re-rendered with error message', async () => {
  // Mock /api/onboard/status success
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({
      gym_id: 'gym-1',
      gym_name: 'Iron Society',
      billing: { has_subscription: true },
    }),
  });

  await act(async () => {
    render(<SetupPage />);
  });

  // Machine form visible
  expect(screen.getByTestId('machine-form-mock')).toBeInTheDocument();

  // Mock POST failure
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 500,
    ok: false,
    json: async () => ({ error: 'Internal server error' }),
  });

  // Submit
  await act(async () => {
    fireEvent.click(screen.getByTestId('submit-machine'));
  });

  // Form still rendered (returned to machine-form step)
  expect(screen.getByTestId('machine-form-mock')).toBeInTheDocument();

  // Error message visible
  await waitFor(() => {
    expect(screen.getByTestId('form-error')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
// Test 4: "Skip for now" link present and points to /setup/import
// ─────────────────────────────────────────────────────────

test('T4: "Skip for now" link present and points to /setup/import', async () => {
  // Mock /api/onboard/status success
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({
      gym_id: 'gym-1',
      gym_name: 'Iron Society',
      billing: { has_subscription: true },
    }),
  });

  await act(async () => {
    render(<SetupPage />);
  });

  const skipLink = screen.getByTestId('skip-link');
  expect(skipLink).toBeInTheDocument();
  expect(skipLink).toHaveAttribute('href', '/setup/import');
});
