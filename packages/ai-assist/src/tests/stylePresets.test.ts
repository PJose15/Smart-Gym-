import { describe, it, expect } from 'vitest';
import {
  applyVerbosity,
  applyTone,
  feedbackTrendNote,
  adherenceNote,
} from '../trainerCopilot/templates';
import { buildWorkoutDraft } from '../trainerCopilot/buildWorkoutDraft';
import { buildWeeklyDraft } from '../trainerCopilot/buildWeeklyDraft';
import type { WorkoutDraftInput, WeeklyDraftInput } from '../trainerCopilot/types';

describe('applyVerbosity', () => {
  it('short mode returns only the first sentence', () => {
    const text = 'First sentence here. Second sentence follows. Third one too.';
    expect(applyVerbosity(text, 'short')).toBe('First sentence here.');
  });

  it('standard mode returns full text', () => {
    const text = 'First sentence. Second sentence.';
    expect(applyVerbosity(text, 'standard')).toBe(text);
  });

  it('detailed mode returns full text', () => {
    const text = 'Full text here. More details.';
    expect(applyVerbosity(text, 'detailed')).toBe(text);
  });

  it('handles text without periods', () => {
    const text = 'No period here';
    expect(applyVerbosity(text, 'short')).toBe(text);
  });
});

describe('applyTone', () => {
  it('strict replaces encouraging phrases with direct ones', () => {
    const text = 'Consider reducing weight. Great work!';
    const result = applyTone(text, 'strict');
    expect(result).toContain('Do reducing weight');
    expect(result).toContain('Good.');
    expect(result).not.toContain('Great work!');
  });

  it('neutral removes exclamation phrases', () => {
    const text = 'Volume up 15%. Great work! That\'s strong progress.';
    const result = applyTone(text, 'neutral');
    expect(result).not.toContain('Great work!');
    expect(result).not.toContain("That's strong progress.");
  });

  it('supportive returns text unchanged', () => {
    const text = 'Great work! Keep it up.';
    expect(applyTone(text, 'supportive')).toBe(text);
  });
});

describe('feedbackTrendNote', () => {
  it('returns empty string for 0 count', () => {
    expect(feedbackTrendNote(0, [])).toBe('');
  });

  it('includes body areas in message', () => {
    const result = feedbackTrendNote(3, ['knee', 'back']);
    expect(result).toContain('knee, back');
    expect(result).toContain('3');
  });

  it('strict tone uses direct phrasing', () => {
    const result = feedbackTrendNote(2, ['shoulder'], 'strict');
    expect(result).toContain('Address this');
  });

  it('neutral tone uses factual phrasing', () => {
    const result = feedbackTrendNote(2, ['shoulder'], 'neutral');
    expect(result).toContain('Consider adjusting');
  });

  it('supportive tone (default) uses encouraging phrasing', () => {
    const result = feedbackTrendNote(2, ['shoulder']);
    expect(result).toContain('keep an eye');
  });
});

describe('adherenceNote', () => {
  it('includes percentage', () => {
    const result = adherenceNote(3, 5);
    expect(result).toContain('60%');
  });

  it('celebrates meeting all sessions', () => {
    const result = adherenceNote(4, 4);
    expect(result).toContain('great consistency');
  });

  it('strict tone for low adherence', () => {
    const result = adherenceNote(1, 5, 'strict');
    expect(result).toContain('needs improvement');
  });

  it('neutral tone is factual', () => {
    const result = adherenceNote(3, 5, 'neutral');
    expect(result).toContain('3 of 5');
    expect(result).toContain('60%');
  });
});

describe('Draft output varies by style', () => {
  const baseWorkoutInput: WorkoutDraftInput = {
    memberName: 'Test User',
    exercises: [],
    prs: [],
    volumeChangePct: null,
    totalVolumeKg: 1000,
    totalSets: 10,
    totalReps: 80,
    feedbackTrends: { discomfort_count_7d: 2, unstable_count_7d: 0, top_body_areas: ['knee'] },
  };

  it('default style (supportive/standard) includes full feedback text', () => {
    const result = buildWorkoutDraft(baseWorkoutInput);
    expect(result.draft_body).toContain('knee');
    expect(result.draft_body).toContain('keep an eye');
  });

  it('strict tone changes phrasing', () => {
    const result = buildWorkoutDraft({
      ...baseWorkoutInput,
      style: { tone: 'strict', verbosity: 'standard' },
    });
    expect(result.draft_body).toContain('knee');
    expect(result.draft_body).toContain('Address this');
  });

  it('short verbosity truncates to first sentence', () => {
    const result = buildWorkoutDraft({
      ...baseWorkoutInput,
      style: { tone: 'supportive', verbosity: 'short' },
    });
    // Should be a single sentence (ends with period, no second sentence)
    const sentences = result.draft_body.split(/[.!?]/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(1);
  });

  it('signals include feedback_trends', () => {
    const result = buildWorkoutDraft(baseWorkoutInput);
    expect(result.signals.feedback_trends).toBeDefined();
    expect(result.signals.feedback_trends!.discomfort_count_7d).toBe(2);
  });

  it('signals include adherence_vs_plan when provided', () => {
    const result = buildWorkoutDraft({
      ...baseWorkoutInput,
      adherenceVsPlan: { expected_workouts: 4, actual_workouts: 3 },
    });
    expect(result.signals.adherence_vs_plan).toBeDefined();
    expect(result.signals.adherence_vs_plan!.actual_workouts).toBe(3);
  });
});
