import { describe, it, expect } from 'vitest';
import {
  getRecoveryHoursRequired,
  calculateMuscleState,
  buildMuscleRecommendations,
  calculateBalanceScore,
} from '../rules/muscleRecovery';
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_MAP,
  MACHINE_MUSCLE_MAP,
  normalizeMachineName,
  getMachineMuscleMappings,
} from '../rules/muscleGroups';
import type { MuscleGroupKey, MuscleRecoveryState } from '@nexera/types';

// ─── Helpers ────────────────────────────────────────────

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function makeAllFreshStates(): Record<MuscleGroupKey, MuscleRecoveryState> {
  const states = {} as Record<MuscleGroupKey, MuscleRecoveryState>;
  for (const group of MUSCLE_GROUPS) {
    states[group.key] = {
      key: group.key,
      label: group.label,
      state: 'fresh',
      hoursSinceTraining: null,
      recoveryPct: 100,
      lastTrainedAt: null,
      color: '#00C896',
    };
  }
  return states;
}

// ─── Muscle Groups Constants ────────────────────────────

describe('muscleGroups', () => {
  it('has 17 muscle groups', () => {
    expect(MUSCLE_GROUPS).toHaveLength(17);
  });

  it('all groups have required fields', () => {
    for (const g of MUSCLE_GROUPS) {
      expect(g.key).toBeDefined();
      expect(g.label).toBeDefined();
      expect(['front', 'back']).toContain(g.side);
      expect(g.recoveryBaseHours).toBeGreaterThan(0);
    }
  });

  it('MUSCLE_GROUP_MAP has entry for each group', () => {
    expect(Object.keys(MUSCLE_GROUP_MAP)).toHaveLength(17);
    for (const g of MUSCLE_GROUPS) {
      expect(MUSCLE_GROUP_MAP[g.key]).toBeDefined();
    }
  });

  it('has front and back body groups', () => {
    const frontCount = MUSCLE_GROUPS.filter(g => g.side === 'front').length;
    const backCount = MUSCLE_GROUPS.filter(g => g.side === 'back').length;
    expect(frontCount).toBeGreaterThan(0);
    expect(backCount).toBeGreaterThan(0);
  });
});

// ─── Machine Muscle Map ─────────────────────────────────

describe('MACHINE_MUSCLE_MAP', () => {
  it('has at least 25 machine entries', () => {
    expect(Object.keys(MACHINE_MUSCLE_MAP).length).toBeGreaterThanOrEqual(25);
  });

  it('all mappings reference valid muscle group keys', () => {
    const validKeys = new Set(MUSCLE_GROUPS.map(g => g.key));
    for (const [machine, mapping] of Object.entries(MACHINE_MUSCLE_MAP)) {
      for (const key of [...mapping.primary, ...mapping.secondary]) {
        expect(validKeys.has(key)).toBe(true);
      }
      expect(mapping.primary.length).toBeGreaterThan(0);
    }
  });
});

// ─── normalizeMachineName ───────────────────────────────

describe('normalizeMachineName', () => {
  it('lowercases', () => {
    expect(normalizeMachineName('Bench Press')).toBe('bench press');
  });

  it('removes special characters', () => {
    expect(normalizeMachineName('Lat Pull-Down (Machine)')).toBe('lat pulldown machine');
  });

  it('collapses whitespace', () => {
    expect(normalizeMachineName('cable   row')).toBe('cable row');
  });

  it('trims', () => {
    expect(normalizeMachineName('  squat  ')).toBe('squat');
  });
});

// ─── getMachineMuscleMappings ───────────────────────────

describe('getMachineMuscleMappings', () => {
  it('exact match', () => {
    const result = getMachineMuscleMappings('bench press');
    expect(result.primary).toContain('chest');
    expect(result.secondary).toContain('triceps');
  });

  it('case insensitive match', () => {
    const result = getMachineMuscleMappings('Bench Press');
    expect(result.primary).toContain('chest');
  });

  it('partial match — "hammer curl machine"', () => {
    const result = getMachineMuscleMappings('hammer curl machine');
    expect(result.primary).toContain('biceps');
  });

  it('unknown machine returns empty arrays', () => {
    const result = getMachineMuscleMappings('underwater basket weaver 3000');
    expect(result.primary).toEqual([]);
    expect(result.secondary).toEqual([]);
  });
});

// ─── getRecoveryHoursRequired ───────────────────────────

describe('getRecoveryHoursRequired', () => {
  it('base hours at RPE 8, primary', () => {
    expect(getRecoveryHoursRequired(48, 8, true)).toBe(48);
  });

  it('lower RPE reduces recovery time', () => {
    expect(getRecoveryHoursRequired(48, 6, true)).toBe(38); // 48 * 0.8
    expect(getRecoveryHoursRequired(48, 7, true)).toBe(43); // 48 * 0.9
  });

  it('higher RPE increases recovery time', () => {
    expect(getRecoveryHoursRequired(48, 9, true)).toBe(55);  // 48 * 1.15
    expect(getRecoveryHoursRequired(48, 10, true)).toBe(62); // 48 * 1.3
  });

  it('secondary muscles need 60% of recovery time', () => {
    expect(getRecoveryHoursRequired(48, 8, false)).toBe(29); // 48 * 1.0 * 0.6
  });

  it('secondary + high RPE', () => {
    expect(getRecoveryHoursRequired(48, 10, false)).toBe(37); // 48 * 1.3 * 0.6
  });

  it('short recovery base (24h) at RPE 6', () => {
    expect(getRecoveryHoursRequired(24, 6, true)).toBe(19); // 24 * 0.8
  });
});

// ─── calculateMuscleState ───────────────────────────────

describe('calculateMuscleState', () => {
  const now = new Date('2025-01-15T12:00:00Z');

  it('never trained → fresh, null hours', () => {
    const result = calculateMuscleState('chest', null, 8, true, now);
    expect(result.state).toBe('fresh');
    expect(result.hoursSinceTraining).toBeNull();
    expect(result.recoveryPct).toBe(100);
    expect(result.color).toBe('#00C896');
  });

  it('trained 2 hours ago → fatigued (< 8h boundary)', () => {
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 2 * 3600000).toISOString(),
      8,
      true,
      now
    );
    expect(result.state).toBe('fatigued');
    expect(result.hoursSinceTraining).toBe(2);
    expect(result.color).toBe('#FFB020');
  });

  it('trained 7 hours ago → fatigued (still < 8h)', () => {
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 7 * 3600000).toISOString(),
      8,
      true,
      now
    );
    expect(result.state).toBe('fatigued');
  });

  it('trained 10 hours ago → recovering (8h < t < recovery_hours)', () => {
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 10 * 3600000).toISOString(),
      8,
      true,
      now
    );
    // chest base 48h, RPE 8 → 48h required. 10h < 48h → recovering
    expect(result.state).toBe('recovering');
  });

  it('trained 50 hours ago, chest RPE 8 → primed (48h < t < 72h)', () => {
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 50 * 3600000).toISOString(),
      8,
      true,
      now
    );
    // recoveryRequired = 48h, primed = 48h..72h (1.5x)
    expect(result.state).toBe('primed');
    expect(result.color).toBe('#7C5CFF');
  });

  it('trained 80 hours ago, chest RPE 8 → fresh (> 72h = 1.5x48)', () => {
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 80 * 3600000).toISOString(),
      8,
      true,
      now
    );
    expect(result.state).toBe('fresh');
  });

  it('high RPE extends recovery window', () => {
    // RPE 10: chest recovery = 48 * 1.3 = 62.4h → 62h
    // Trained 50h ago: 50 < 62 → still recovering
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 50 * 3600000).toISOString(),
      10,
      true,
      now
    );
    expect(result.state).toBe('recovering');
  });

  it('secondary muscle recovers faster', () => {
    // chest as secondary: 48 * 1.0 * 0.6 = 28.8 → 29h
    // Trained 30h ago: 30 > 29 → primed window (29h..43.5h)
    const result = calculateMuscleState(
      'chest',
      new Date(now.getTime() - 30 * 3600000).toISOString(),
      8,
      false,
      now
    );
    expect(result.state).toBe('primed');
  });

  it('recovery percentage is clamped to 100', () => {
    const result = calculateMuscleState(
      'abs',
      new Date(now.getTime() - 200 * 3600000).toISOString(),
      6,
      true,
      now
    );
    expect(result.recoveryPct).toBe(100);
  });

  it('returns correct label from MUSCLE_GROUP_MAP', () => {
    const result = calculateMuscleState('front_delts', null, 8, true, now);
    expect(result.label).toBe('Front Delts');
  });
});

// ─── buildMuscleRecommendations ─────────────────────────

describe('buildMuscleRecommendations', () => {
  it('all fresh → full body message', () => {
    const states = makeAllFreshStates();
    const recs = buildMuscleRecommendations(states);
    expect(recs.readyToTrain).toHaveLength(17);
    expect(recs.needsRecovery).toHaveLength(0);
    expect(recs.message).toContain('full body');
  });

  it('all recovering → rest day message', () => {
    const states = makeAllFreshStates();
    for (const key of Object.keys(states) as MuscleGroupKey[]) {
      states[key] = { ...states[key], state: 'recovering' };
    }
    const recs = buildMuscleRecommendations(states);
    expect(recs.readyToTrain).toHaveLength(0);
    expect(recs.needsRecovery).toHaveLength(17);
    expect(recs.message).toContain('rest day');
  });

  it('some primed → primed muscles mentioned in message', () => {
    const states = makeAllFreshStates();
    states.chest = { ...states.chest, state: 'primed' };
    states.triceps = { ...states.triceps, state: 'primed' };
    // Need some recovering muscles so message isn't "full body"
    states.quads = { ...states.quads, state: 'recovering' };
    states.hamstrings = { ...states.hamstrings, state: 'recovering' };
    const recs = buildMuscleRecommendations(states);
    expect(recs.suggestedFocus).toContain('chest');
    expect(recs.suggestedFocus).toContain('triceps');
    expect(recs.message).toContain('optimal training window');
  });

  it('suggestedFocus limited to 4', () => {
    const states = makeAllFreshStates();
    // Make 6 muscles primed
    const primedKeys: MuscleGroupKey[] = ['chest', 'triceps', 'biceps', 'quads', 'glutes', 'lats'];
    for (const k of primedKeys) {
      states[k] = { ...states[k], state: 'primed' };
    }
    const recs = buildMuscleRecommendations(states);
    expect(recs.suggestedFocus).toHaveLength(4);
  });

  it('mixed states → count ready message', () => {
    const states = makeAllFreshStates();
    // Make some fatigued, rest stay fresh
    states.chest = { ...states.chest, state: 'fatigued' };
    states.triceps = { ...states.triceps, state: 'fatigued' };
    const recs = buildMuscleRecommendations(states);
    expect(recs.readyToTrain).toHaveLength(15);
    expect(recs.needsRecovery).toHaveLength(2);
    expect(recs.message).toContain('ready to train');
  });
});

// ─── calculateBalanceScore ──────────────────────────────

describe('calculateBalanceScore', () => {
  it('all fresh (never trained) → 0 (no training data)', () => {
    const states = makeAllFreshStates();
    expect(calculateBalanceScore(states)).toBe(0);
  });

  it('all muscles trained same time ago → high score', () => {
    const states = makeAllFreshStates();
    const trainedAt = hoursAgo(24);
    for (const key of Object.keys(states) as MuscleGroupKey[]) {
      states[key] = { ...states[key], hoursSinceTraining: 24, lastTrainedAt: trainedAt };
    }
    expect(calculateBalanceScore(states)).toBe(100);
  });

  it('only one muscle trained recently → lower score', () => {
    const states = makeAllFreshStates();
    states.chest = { ...states.chest, hoursSinceTraining: 2, lastTrainedAt: hoursAgo(2) };
    const score = calculateBalanceScore(states);
    expect(score).toBeLessThan(80);
  });

  it('upper/lower split pattern → moderate score', () => {
    const states = makeAllFreshStates();
    // Upper body trained 12h ago
    const upperKeys: MuscleGroupKey[] = ['chest', 'front_delts', 'side_delts', 'biceps', 'triceps', 'upper_back', 'lats'];
    for (const k of upperKeys) {
      states[k] = { ...states[k], hoursSinceTraining: 12, lastTrainedAt: hoursAgo(12) };
    }
    // Lower body and rest at default (168h)
    const score = calculateBalanceScore(states);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(90);
  });

  it('score is always between 0 and 100', () => {
    const states = makeAllFreshStates();
    states.chest = { ...states.chest, hoursSinceTraining: 1 };
    const score = calculateBalanceScore(states);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
