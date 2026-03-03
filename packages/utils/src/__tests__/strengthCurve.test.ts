import { describe, it, expect } from 'vitest';
import { computeStrengthCurve } from '../index';

describe('computeStrengthCurve', () => {
  it('returns empty array for empty sets', () => {
    expect(computeStrengthCurve([])).toEqual([]);
  });

  it('returns empty array for invalid sets', () => {
    expect(computeStrengthCurve([
      { weight_kg: 0, reps: 5 },
      { weight_kg: 50, reps: 0 },
      { weight_kg: -10, reps: 3 },
    ])).toEqual([]);
  });

  it('places a single set in the correct bucket', () => {
    const result = computeStrengthCurve([{ weight_kg: 100, reps: 5 }]);
    expect(result).toHaveLength(1);
    expect(result[0].repRange).toBe('4-6');
    expect(result[0].bestWeight).toBe(100);
    expect(result[0].setCount).toBe(1);
    expect(result[0].best1RM).toBeGreaterThan(0);
  });

  it('1-rep set returns weight as 1RM', () => {
    const result = computeStrengthCurve([{ weight_kg: 120, reps: 1 }]);
    expect(result).toHaveLength(1);
    expect(result[0].repRange).toBe('1-3');
    expect(result[0].best1RM).toBe(120);
  });

  it('tracks best weight and best 1RM across multiple sets in same bucket', () => {
    const result = computeStrengthCurve([
      { weight_kg: 60, reps: 8 },
      { weight_kg: 70, reps: 7 },
      { weight_kg: 65, reps: 10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].repRange).toBe('7-10');
    expect(result[0].bestWeight).toBe(70);
    expect(result[0].setCount).toBe(3);
  });

  it('distributes sets across multiple buckets in order', () => {
    const result = computeStrengthCurve([
      { weight_kg: 100, reps: 1 },  // 1-3
      { weight_kg: 80, reps: 5 },   // 4-6
      { weight_kg: 60, reps: 8 },   // 7-10
      { weight_kg: 45, reps: 12 },  // 11-15
      { weight_kg: 30, reps: 20 },  // 16+
    ]);
    expect(result).toHaveLength(5);
    expect(result[0].repRange).toBe('1-3');
    expect(result[1].repRange).toBe('4-6');
    expect(result[2].repRange).toBe('7-10');
    expect(result[3].repRange).toBe('11-15');
    expect(result[4].repRange).toBe('16+');
  });

  it('omits empty buckets', () => {
    const result = computeStrengthCurve([
      { weight_kg: 100, reps: 3 },  // 1-3
      { weight_kg: 50, reps: 12 },  // 11-15
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].repRange).toBe('1-3');
    expect(result[1].repRange).toBe('11-15');
  });

  it('higher reps at same weight yields higher estimated 1RM (Brzycki)', () => {
    const result = computeStrengthCurve([
      { weight_kg: 80, reps: 3 },   // 1-3 bucket
      { weight_kg: 80, reps: 10 },  // 7-10 bucket
    ]);
    // Brzycki: more reps at same weight means higher estimated max
    const lowRep = result.find((r) => r.repRange === '1-3')!;
    const highRep = result.find((r) => r.repRange === '7-10')!;
    expect(highRep.best1RM).toBeGreaterThan(lowRep.best1RM);
  });
});
