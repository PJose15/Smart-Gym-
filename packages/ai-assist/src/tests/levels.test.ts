import { describe, it, expect } from 'vitest';
import { computeLevel, computeLevelProgress, ALL_LEVELS } from '../rules/levels';

describe('computeLevel', () => {
  it('returns Newcomer for score 0', () => {
    expect(computeLevel(0).name).toBe('Newcomer');
    expect(computeLevel(0).level).toBe(1);
  });

  it('returns Newcomer for negative score', () => {
    expect(computeLevel(-50).name).toBe('Newcomer');
  });

  it('returns Newcomer for NaN score', () => {
    expect(computeLevel(NaN).name).toBe('Newcomer');
    expect(computeLevel(NaN).level).toBe(1);
  });

  it('returns Newcomer for Infinity score treated as Legend', () => {
    expect(computeLevel(Infinity).name).toBe('Newcomer');
  });

  it('returns Regular at exactly 100', () => {
    expect(computeLevel(100).name).toBe('Regular');
    expect(computeLevel(100).level).toBe(2);
  });

  it('returns Newcomer at 99', () => {
    expect(computeLevel(99).name).toBe('Newcomer');
  });

  it('returns Dedicated at 300', () => {
    expect(computeLevel(300).name).toBe('Dedicated');
  });

  it('returns Committed at 600', () => {
    expect(computeLevel(600).name).toBe('Committed');
  });

  it('returns Warrior at 1000', () => {
    expect(computeLevel(1000).name).toBe('Warrior');
  });

  it('returns Veteran at 1800', () => {
    expect(computeLevel(1800).name).toBe('Veteran');
  });

  it('returns Elite at 3000', () => {
    expect(computeLevel(3000).name).toBe('Elite');
  });

  it('returns Champion at 5000', () => {
    expect(computeLevel(5000).name).toBe('Champion');
  });

  it('returns Master at 7500', () => {
    expect(computeLevel(7500).name).toBe('Master');
  });

  it('returns Legend at 10000', () => {
    expect(computeLevel(10000).name).toBe('Legend');
    expect(computeLevel(10000).level).toBe(10);
  });

  it('returns Legend for very high scores', () => {
    expect(computeLevel(999999).name).toBe('Legend');
  });

  it('stays in current level just below boundary', () => {
    expect(computeLevel(299).name).toBe('Regular');
    expect(computeLevel(599).name).toBe('Dedicated');
    expect(computeLevel(999).name).toBe('Committed');
    expect(computeLevel(1799).name).toBe('Warrior');
    expect(computeLevel(2999).name).toBe('Veteran');
    expect(computeLevel(4999).name).toBe('Elite');
    expect(computeLevel(7499).name).toBe('Champion');
    expect(computeLevel(9999).name).toBe('Master');
  });
});

describe('computeLevelProgress', () => {
  it('returns 0% progress at start of level', () => {
    const progress = computeLevelProgress(0);
    expect(progress.current.name).toBe('Newcomer');
    expect(progress.progressPct).toBe(0);
    expect(progress.pointsToNext).toBe(100);
  });

  it('returns 50% progress at midpoint of Newcomer', () => {
    const progress = computeLevelProgress(50);
    expect(progress.progressPct).toBe(50);
    expect(progress.pointsToNext).toBe(50);
  });

  it('returns next level info', () => {
    const progress = computeLevelProgress(50);
    expect(progress.next?.name).toBe('Regular');
    expect(progress.next?.level).toBe(2);
  });

  it('returns 100% and 0 pointsToNext for Legend', () => {
    const progress = computeLevelProgress(10000);
    expect(progress.current.name).toBe('Legend');
    expect(progress.progressPct).toBe(100);
    expect(progress.pointsToNext).toBe(0);
    expect(progress.next).toBeNull();
  });

  it('returns 100% for Legend at high scores', () => {
    const progress = computeLevelProgress(50000);
    expect(progress.current.name).toBe('Legend');
    expect(progress.progressPct).toBe(100);
  });

  it('correctly computes progress in Regular level', () => {
    // Regular: 100 to 300 (range = 200)
    const progress = computeLevelProgress(200);
    expect(progress.current.name).toBe('Regular');
    expect(progress.progressPct).toBe(50);
    expect(progress.pointsToNext).toBe(100);
  });

  it('handles negative scores gracefully', () => {
    const progress = computeLevelProgress(-100);
    expect(progress.current.name).toBe('Newcomer');
    expect(progress.progressPct).toBe(0);
    expect(progress.score).toBe(0);
  });

  it('handles NaN score gracefully', () => {
    const progress = computeLevelProgress(NaN);
    expect(progress.current.name).toBe('Newcomer');
    expect(progress.progressPct).toBe(0);
    expect(progress.pointsToNext).toBe(100);
    expect(progress.score).toBe(0);
  });

  it('returns 99% progress at score 99 (Newcomer boundary)', () => {
    const progress = computeLevelProgress(99);
    expect(progress.current.name).toBe('Newcomer');
    expect(progress.progressPct).toBe(99);
    expect(progress.pointsToNext).toBe(1);
  });

  it('returns 0% progress at exact level boundary (100 = Regular start)', () => {
    const progress = computeLevelProgress(100);
    expect(progress.current.name).toBe('Regular');
    expect(progress.progressPct).toBe(0);
    expect(progress.pointsToNext).toBe(200);
  });

  it('computes mid-range Warrior progress (1400/800 range = 50%)', () => {
    // Warrior: 1000-1800, range = 800, at 1400 → (400/800)*100 = 50%
    const progress = computeLevelProgress(1400);
    expect(progress.current.name).toBe('Warrior');
    expect(progress.progressPct).toBe(50);
    expect(progress.pointsToNext).toBe(400);
  });

  it('computes Champion near-boundary (7499 → 99%)', () => {
    // Champion: 5000-7500, range = 2500, at 7499 → (2499/2500)*100 = 99.96 → 100 rounded
    const progress = computeLevelProgress(7499);
    expect(progress.current.name).toBe('Champion');
    expect(progress.progressPct).toBe(100);
    expect(progress.pointsToNext).toBe(1);
  });

  it('returns score field matching clamped input', () => {
    expect(computeLevelProgress(500).score).toBe(500);
    expect(computeLevelProgress(-50).score).toBe(0);
  });
});

describe('ALL_LEVELS', () => {
  it('has exactly 10 levels', () => {
    expect(ALL_LEVELS).toHaveLength(10);
  });

  it('levels are contiguous (no gaps)', () => {
    for (let i = 1; i < ALL_LEVELS.length; i++) {
      expect(ALL_LEVELS[i].minScore).toBe(ALL_LEVELS[i - 1].maxScore);
    }
  });

  it('last level has Infinity maxScore', () => {
    expect(ALL_LEVELS[ALL_LEVELS.length - 1].maxScore).toBe(Infinity);
  });
});
