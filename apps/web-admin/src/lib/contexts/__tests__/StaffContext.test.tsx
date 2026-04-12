/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { StaffProvider, useStaff, useStaffWeightUnit } from '../StaffContext';

// ── Mocks ──────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let fetchResponse: { ok: boolean; json: () => Promise<Record<string, unknown>> };

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  fetchResponse = {
    ok: true,
    json: async () => ({
      user_id: 'u1',
      gym_id: 'g1',
      role: 'trainer',
      full_name: 'Jane Doe',
      email: 'jane@gym.com',
      avatar_url: null,
      gym: { id: 'g1', name: 'Iron Paradise', slug: 'iron-paradise', logo_url: null },
      weight_unit: 'lbs',
    }),
  };
  global.fetch = jest.fn().mockImplementation(async () => fetchResponse);
});

// ── Consumer helper ────────────────────────────────

function StaffConsumer() {
  const { staff, authed } = useStaff();
  const unit = useStaffWeightUnit();
  return (
    <div>
      <span data-testid="authed">{String(authed)}</span>
      <span data-testid="unit">{unit}</span>
      <span data-testid="name">{staff?.full_name ?? '—'}</span>
    </div>
  );
}

// ── Tests ──────────────────────────────────────────

describe('StaffProvider', () => {
  it('hydrates staff info and weight unit from /api/auth/staff/me', async () => {
    await act(async () => {
      render(
        <StaffProvider>
          <StaffConsumer />
        </StaffProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('authed').textContent).toBe('true');
    });
    expect(screen.getByTestId('name').textContent).toBe('Jane Doe');
    expect(screen.getByTestId('unit').textContent).toBe('lbs');
  });

  it('returns kg when gym_settings has kg', async () => {
    fetchResponse = {
      ok: true,
      json: async () => ({
        user_id: 'u2',
        gym_id: 'g2',
        role: 'owner',
        weight_unit: 'kg',
      }),
    };

    await act(async () => {
      render(
        <StaffProvider>
          <StaffConsumer />
        </StaffProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('unit').textContent).toBe('kg');
    });
  });

  it('defaults to lbs when weight_unit is missing', async () => {
    fetchResponse = {
      ok: true,
      json: async () => ({
        user_id: 'u3',
        gym_id: 'g3',
        role: 'trainer',
      }),
    };

    await act(async () => {
      render(
        <StaffProvider>
          <StaffConsumer />
        </StaffProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('authed').textContent).toBe('true');
    });
    expect(screen.getByTestId('unit').textContent).toBe('lbs');
  });

  it('redirects to /staff/login on 401', async () => {
    fetchResponse = { ok: false, json: async () => ({ error: 'Unauthorized' }) };

    await act(async () => {
      render(
        <StaffProvider>
          <StaffConsumer />
        </StaffProvider>,
      );
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/staff/login');
    });
  });

  it('redirects when role is not in allowedRoles', async () => {
    fetchResponse = {
      ok: true,
      json: async () => ({
        user_id: 'u1',
        gym_id: 'g1',
        role: 'trainer',
        weight_unit: 'lbs',
      }),
    };

    await act(async () => {
      render(
        <StaffProvider allowedRoles={['owner']}>
          <StaffConsumer />
        </StaffProvider>,
      );
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/staff/login');
    });
  });

  it('renders fallback while loading', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <StaffProvider fallback={<div data-testid="spinner">Loading</div>}>
        <StaffConsumer />
      </StaffProvider>,
    );

    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(container.querySelector('[data-testid="authed"]')).toBeNull();
  });
});
