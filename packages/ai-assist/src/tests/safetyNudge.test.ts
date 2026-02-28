import { describe, it, expect } from 'vitest';
import { getSafetyNudge } from '../rules/safetyNudge';

describe('getSafetyNudge', () => {
  it('returns null when discomfort count is 0', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 0,
      unstableCount7d: 0,
      topBodyAreas: [],
      exerciseName: 'Bench Press',
    });
    expect(result).toBeNull();
  });

  it('returns gentle nudge for 1 discomfort', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 1,
      unstableCount7d: 0,
      topBodyAreas: ['shoulder'],
      exerciseName: 'Overhead Press',
    });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('gentle');
    expect(result!.should_suppress_suggestion).toBe(false);
    expect(result!.message).toContain('shoulder');
    expect(result!.message).toContain('Overhead Press');
  });

  it('returns moderate nudge for 2 discomforts', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 2,
      unstableCount7d: 1,
      topBodyAreas: ['knee'],
      exerciseName: 'Leg Press',
    });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('moderate');
    expect(result!.should_suppress_suggestion).toBe(false);
    expect(result!.message).toContain('knee');
  });

  it('returns strong nudge for 3+ discomforts with suggestion suppression', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 4,
      unstableCount7d: 2,
      topBodyAreas: ['back', 'knee'],
      exerciseName: 'Deadlift',
    });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('strong');
    expect(result!.should_suppress_suggestion).toBe(true);
    expect(result!.message).toContain('back, knee');
    expect(result!.message).toContain('Deadlift');
  });

  it('returns strong nudge for exactly 3 discomforts', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 3,
      unstableCount7d: 0,
      topBodyAreas: ['wrist'],
      exerciseName: 'Wrist Curl',
    });
    expect(result!.level).toBe('strong');
    expect(result!.should_suppress_suggestion).toBe(true);
  });

  it('uses fallback text when no body areas provided', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 1,
      unstableCount7d: 0,
      topBodyAreas: [],
      exerciseName: 'Cable Fly',
    });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('a body area');
  });

  it('includes exercise name in all nudge levels', () => {
    for (const count of [1, 2, 5]) {
      const result = getSafetyNudge({
        discomfortCount7d: count,
        unstableCount7d: 0,
        topBodyAreas: ['shoulder'],
        exerciseName: 'Lat Pulldown',
      });
      expect(result!.message).toContain('Lat Pulldown');
    }
  });

  it('includes count in strong nudge message', () => {
    const result = getSafetyNudge({
      discomfortCount7d: 5,
      unstableCount7d: 0,
      topBodyAreas: ['back'],
      exerciseName: 'Row',
    });
    expect(result!.message).toContain('5x');
  });
});
