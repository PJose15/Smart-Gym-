import { describe, it, expect } from 'vitest';
import { extractAiProgramDays, type AiProgramDayJson } from '../index';

const day = (n: number): AiProgramDayJson => ({
  day_number: n,
  name: `Day ${n}`,
  exercises: [{ exercise_name: 'Bench Press', default_sets: 3, default_reps: 10 }],
});

describe('extractAiProgramDays', () => {
  it('returns days from the canonical { days } shape', () => {
    const result = extractAiProgramDays({ days: [day(1), day(2)] });
    expect(result).toHaveLength(2);
    expect(result[0].day_number).toBe(1);
    expect(result[1].name).toBe('Day 2');
  });

  it('falls back to the first week of a { weeks: [{ days }] } shape', () => {
    const result = extractAiProgramDays({
      weeks: [{ days: [day(1), day(2), day(3)] }, { days: [day(4)] }],
    });
    expect(result).toHaveLength(3);
    expect(result[0].day_number).toBe(1);
  });

  it('skips weeks with empty day lists and uses the first non-empty week', () => {
    const result = extractAiProgramDays({
      weeks: [{ days: [] }, {}, { days: [day(5), day(6)] }],
    });
    expect(result).toHaveLength(2);
    expect(result[0].day_number).toBe(5);
  });

  it('prefers a non-empty days array over weeks when both exist', () => {
    const result = extractAiProgramDays({
      days: [day(1)],
      weeks: [{ days: [day(9)] }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].day_number).toBe(1);
  });

  it('falls through to weeks when days is an empty array', () => {
    const result = extractAiProgramDays({ days: [], weeks: [{ days: [day(7)] }] });
    expect(result).toHaveLength(1);
    expect(result[0].day_number).toBe(7);
  });

  it('returns [] for null', () => {
    expect(extractAiProgramDays(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(extractAiProgramDays(undefined)).toEqual([]);
  });

  it('returns [] for non-object values', () => {
    expect(extractAiProgramDays('days')).toEqual([]);
    expect(extractAiProgramDays(42)).toEqual([]);
  });

  it('returns [] when days is not an array and weeks is missing', () => {
    expect(extractAiProgramDays({ days: { day_number: 1 } })).toEqual([]);
  });

  it('returns [] when weeks is empty or has only dayless weeks', () => {
    expect(extractAiProgramDays({ weeks: [] })).toEqual([]);
    expect(extractAiProgramDays({ weeks: [{}, { days: [] }] })).toEqual([]);
  });

  it('supports a caller-provided stricter day type', () => {
    interface StrictDay { day_number: number; name: string }
    const result = extractAiProgramDays<StrictDay>({
      days: [{ day_number: 1, name: 'Push' }],
    });
    expect(result[0].name).toBe('Push');
  });
});
