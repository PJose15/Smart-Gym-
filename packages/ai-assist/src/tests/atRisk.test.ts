import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeAtRiskMembers } from '../trainerCopilot/atRiskBatch';
import type { MemberData } from '../trainerCopilot/atRiskBatch';

describe('computeAtRiskMembers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags member with no workouts in 7+ days', () => {
    const members: MemberData[] = [
      {
        profileId: 'p1',
        memberName: 'Alice',
        lastWorkoutAt: '2025-06-07T10:00:00Z', // 8 days ago
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toHaveLength(1);
    expect(result[0].reasons[0].type).toBe('no_workouts_7d');
    if (result[0].reasons[0].type === 'no_workouts_7d') {
      expect(result[0].reasons[0].daysSinceLastWorkout).toBe(8);
    }
  });

  it('flags member who has never worked out', () => {
    const members: MemberData[] = [
      {
        profileId: 'p2',
        memberName: 'Bob',
        lastWorkoutAt: null,
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].reasons[0].type).toBe('no_workouts_7d');
    if (result[0].reasons[0].type === 'no_workouts_7d') {
      expect(result[0].reasons[0].daysSinceLastWorkout).toBe(Infinity);
    }
  });

  it('flags member with discomfort >= 3 in 7 days', () => {
    const members: MemberData[] = [
      {
        profileId: 'p3',
        memberName: 'Carol',
        lastWorkoutAt: '2025-06-14T10:00:00Z', // 1 day ago — active
        discomfortCount7d: 4,
        discomfortBodyAreas: ['knee', 'back'],
        plateauExercises: [],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toHaveLength(1);
    expect(result[0].reasons[0].type).toBe('repeated_discomfort');
    if (result[0].reasons[0].type === 'repeated_discomfort') {
      expect(result[0].reasons[0].count).toBe(4);
      expect(result[0].reasons[0].bodyAreas).toEqual(['knee', 'back']);
    }
  });

  it('flags member plateauing 3+ weeks on an exercise', () => {
    const members: MemberData[] = [
      {
        profileId: 'p4',
        memberName: 'Dave',
        lastWorkoutAt: '2025-06-14T10:00:00Z',
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [
          { exerciseName: 'Bench Press', weeksSameWeight: 4 },
        ],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].reasons[0].type).toBe('plateauing');
    if (result[0].reasons[0].type === 'plateauing') {
      expect(result[0].reasons[0].exerciseName).toBe('Bench Press');
      expect(result[0].reasons[0].weeksSameWeight).toBe(4);
    }
  });

  it('does not flag healthy active member', () => {
    const members: MemberData[] = [
      {
        profileId: 'p5',
        memberName: 'Eve',
        lastWorkoutAt: '2025-06-14T10:00:00Z', // 1 day ago
        discomfortCount7d: 1,
        discomfortBodyAreas: ['knee'],
        plateauExercises: [
          { exerciseName: 'Squat', weeksSameWeight: 2 }, // under threshold
        ],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(0);
  });

  it('returns multiple reasons for one member', () => {
    const members: MemberData[] = [
      {
        profileId: 'p6',
        memberName: 'Frank',
        lastWorkoutAt: '2025-06-01T10:00:00Z', // 14 days ago
        discomfortCount7d: 5,
        discomfortBodyAreas: ['shoulder'],
        plateauExercises: [
          { exerciseName: 'OHP', weeksSameWeight: 5 },
        ],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].reasons).toHaveLength(3);
    const types = result[0].reasons.map((r) => r.type);
    expect(types).toContain('no_workouts_7d');
    expect(types).toContain('repeated_discomfort');
    expect(types).toContain('plateauing');
  });

  it('processes multiple members independently', () => {
    const members: MemberData[] = [
      {
        profileId: 'healthy',
        memberName: 'Healthy',
        lastWorkoutAt: '2025-06-14T10:00:00Z',
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [],
      },
      {
        profileId: 'at-risk',
        memberName: 'AtRisk',
        lastWorkoutAt: null,
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe('at-risk');
  });

  it('does not flag plateau under threshold', () => {
    const members: MemberData[] = [
      {
        profileId: 'p7',
        memberName: 'Grace',
        lastWorkoutAt: '2025-06-14T10:00:00Z',
        discomfortCount7d: 0,
        discomfortBodyAreas: [],
        plateauExercises: [
          { exerciseName: 'Deadlift', weeksSameWeight: 2 },
          { exerciseName: 'Row', weeksSameWeight: 1 },
        ],
      },
    ];
    const result = computeAtRiskMembers(members);
    expect(result).toHaveLength(0);
  });
});
