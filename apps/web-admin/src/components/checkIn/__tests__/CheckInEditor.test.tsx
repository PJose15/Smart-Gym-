/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CheckInEditor } from '../CheckInEditor';
import type { CheckInWeekData } from '@nexera/types';

// ── Helpers ────────────────────────────────────────

function makeWeekData(overrides: Partial<CheckInWeekData> = {}): CheckInWeekData {
  return {
    member_id: 'm1',
    member_first_name: 'Alex',
    primary_goal: 'muscle_gain',
    experience_level: 'intermediate',
    months_as_member: 6,
    program_title: null,
    program_week_number: null,
    week_start: '2026-04-06',
    week_end: '2026-04-12',
    sessions_this_week: 4,
    sessions_scheduled: 5,
    sessions_last_week: 3,
    total_volume_lbs: 125000,
    volume_last_week: 100000,
    prs_this_week: 2,
    prs_last_week: 0,
    pr_details: [
      { machine_name: 'Bench Press', weight_lbs: 225, improvement_lbs: 10 },
      { machine_name: 'Squat', weight_lbs: 315, improvement_lbs: 15 },
    ],
    machines_trained: ['Bench Press', 'Squat', 'Deadlift'],
    avg_rpe: 7.5,
    current_streak: 12,
    avg_readiness_score: 72,
    dominant_readiness_zone: 'green',
    most_trained_muscles: ['chest', 'quads'],
    undertrained_muscles: ['hamstrings'],
    push_pull_balance: 55,
    dna_consistency: 85,
    dna_progression: 78,
    dna_balance: 65,
    dna_trend: 'improving',
    injuries_or_limitations: null,
    gym_language: 'en',
    trainer_name: null,
    trainer_id: null,
    ...overrides,
  };
}

const noop = jest.fn().mockResolvedValue(undefined);

// ── Tests ──────────────────────────────────────────

describe('CheckInEditor weight unit rendering', () => {
  it('shows volume in lbs when memberWeightUnit is lbs (default)', () => {
    render(
      <CheckInEditor
        aiDraft="Great week!"
        weekData={makeWeekData()}
        onSend={noop}
        onCancel={noop}
      />,
    );

    // 125000 lbs → "125.0k lbs" (appears in DataRow + TrendRow)
    const lbsMatches = screen.getAllByText('125.0k lbs');
    expect(lbsMatches.length).toBeGreaterThanOrEqual(1);
    // Unit hint
    expect(screen.getByText('weights in lbs')).toBeTruthy();
  });

  it('converts all weight displays to kg when memberWeightUnit is kg', () => {
    render(
      <CheckInEditor
        aiDraft="Great week!"
        weekData={makeWeekData()}
        memberWeightUnit="kg"
        onSend={noop}
        onCancel={noop}
      />,
    );

    // 125000 lbs → ~56,700 kg → "56.7k kg" (appears in DataRow + TrendRow)
    const kgMatches = screen.getAllByText('56.7k kg');
    expect(kgMatches.length).toBeGreaterThanOrEqual(1);
    // Unit hint
    expect(screen.getByText('weights in kg')).toBeTruthy();
  });

  it('formats PR weights in the member unit', () => {
    render(
      <CheckInEditor
        aiDraft="Nice!"
        weekData={makeWeekData()}
        memberWeightUnit="kg"
        onSend={noop}
        onCancel={noop}
      />,
    );

    // 225 lbs → 102 kg
    expect(screen.getByText('102 kg')).toBeTruthy();
    // 315 lbs → 143 kg
    expect(screen.getByText('143 kg')).toBeTruthy();
  });

  it('formats PR improvement delta in the member unit', () => {
    render(
      <CheckInEditor
        aiDraft="Nice!"
        weekData={makeWeekData({
          pr_details: [
            { machine_name: 'OHP', weight_lbs: 135, improvement_lbs: 5 },
          ],
        })}
        memberWeightUnit="kg"
        onSend={noop}
        onCancel={noop}
      />,
    );

    // 5 lbs → ~2.27 kg → "2.3" (< 10 → 1 decimal)
    expect(screen.getByText('+2.3')).toBeTruthy();
  });

  it('populates textarea with aiDraft when not writeOwn', () => {
    render(
      <CheckInEditor
        aiDraft="AI message here"
        weekData={makeWeekData()}
        onSend={noop}
        onCancel={noop}
      />,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('AI message here');
  });

  it('calls onSend with trimmed message', async () => {
    const sendFn = jest.fn().mockResolvedValue(undefined);

    render(
      <CheckInEditor
        aiDraft="AI draft"
        weekData={makeWeekData()}
        onSend={sendFn}
        onCancel={noop}
      />,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '  Custom message  ' } });
    });

    const sendButton = screen.getByText('Send to Alex');
    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(sendFn).toHaveBeenCalledWith('Custom message', true);
    });
  });
});
