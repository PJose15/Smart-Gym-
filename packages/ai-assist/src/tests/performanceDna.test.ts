import { describe, it, expect } from 'vitest';
import { calculatePowerScore } from '../rules/dna/calculatePowerScore';
import { calculateConsistencyScore } from '../rules/dna/calculateConsistencyScore';
import {
  calculateProgressionScore,
  calculateWeightSlope,
} from '../rules/dna/calculateProgressionScore';
import { calculateMindsetScore } from '../rules/dna/calculateMindsetScore';
import { determineArchetype } from '../rules/dna/determineArchetype';
import { ARCHETYPES, ARCHETYPE_PRESTIGE } from '../rules/dnaConstants';
import type { DNAScores } from '@nexera/types';

// ============================================================================
// POWER SCORE TESTS
// ============================================================================

describe('calculatePowerScore', () => {
  it('returns 0 with is_building when no sessions', () => {
    const result = calculatePowerScore({ recentSessions: [], olderSessions: [] });
    expect(result.score).toBe(0);
    expect(result.is_building).toBe(true);
  });

  it('marks is_building when fewer than 5 sessions', () => {
    const sessions = [
      { machine_id: 'm1', best_weight_lbs: 100, total_volume_lbs: 800 },
      { machine_id: 'm1', best_weight_lbs: 110, total_volume_lbs: 900 },
    ];
    const result = calculatePowerScore({ recentSessions: sessions, olderSessions: [] });
    expect(result.is_building).toBe(true);
  });

  it('gives PR score proportional to PR rate', () => {
    // 3/6 = 50% PR rate => 30 pts (max)
    const recent = Array.from({ length: 6 }, (_, i) => ({
      machine_id: `m${i}`,
      best_weight_lbs: i < 3 ? 100 : 0,
      total_volume_lbs: 500,
    }));
    const result = calculatePowerScore({ recentSessions: recent, olderSessions: [] });
    // prScore = 30, progressionScore = 20 (no older data), volumeScore based on 500 avg
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.signals.pr_rate).toBe(50);
  });

  it('gives full progression score for +5% weight increase', () => {
    const recent = [
      { machine_id: 'm1', best_weight_lbs: 105, total_volume_lbs: 1000 },
      { machine_id: 'm1', best_weight_lbs: 100, total_volume_lbs: 1000 },
      { machine_id: 'm2', best_weight_lbs: 210, total_volume_lbs: 1000 },
      { machine_id: 'm2', best_weight_lbs: 200, total_volume_lbs: 1000 },
      { machine_id: 'm3', best_weight_lbs: 50, total_volume_lbs: 1000 },
    ];
    const older = [
      { machine_id: 'm1', best_weight_lbs: 100 },
      { machine_id: 'm2', best_weight_lbs: 200 },
    ];
    const result = calculatePowerScore({ recentSessions: recent, olderSessions: older });
    expect(result.signals.avg_progression_pct).toBeGreaterThanOrEqual(4);
  });

  it('gives higher volume score for higher volume', () => {
    const lowVol = [
      { machine_id: 'm1', best_weight_lbs: 100, total_volume_lbs: 200 },
    ];
    const highVol = [
      { machine_id: 'm1', best_weight_lbs: 100, total_volume_lbs: 3000 },
    ];
    const lowResult = calculatePowerScore({ recentSessions: lowVol, olderSessions: [] });
    const highResult = calculatePowerScore({ recentSessions: highVol, olderSessions: [] });
    expect(highResult.score).toBeGreaterThan(lowResult.score);
  });

  it('caps total score at 100', () => {
    // Max everything: 100% PR rate, +10% progression, 5000 lbs/session
    const recent = Array.from({ length: 10 }, (_, i) => ({
      machine_id: `m${i % 3}`,
      best_weight_lbs: 200,
      total_volume_lbs: 5000,
    }));
    const older = [
      { machine_id: 'm0', best_weight_lbs: 180 },
      { machine_id: 'm1', best_weight_lbs: 180 },
      { machine_id: 'm2', best_weight_lbs: 180 },
    ];
    const result = calculatePowerScore({ recentSessions: recent, olderSessions: older });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// CONSISTENCY SCORE TESTS
// ============================================================================

describe('calculateConsistencyScore', () => {
  it('returns low score with 0 sessions', () => {
    const result = calculateConsistencyScore({
      sessionDatesLast30: [],
      currentStreak: 0,
      bestStreak: 0,
      readinessEntries: [],
    });
    expect(result.score).toBeLessThanOrEqual(15); // only neutral readiness
    expect(result.is_building).toBe(true);
  });

  it('gives full frequency score at 3 sessions/week', () => {
    // 13 sessions in 30 days ~= 3/week
    const dates = Array.from({ length: 13 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
    const result = calculateConsistencyScore({
      sessionDatesLast30: dates,
      currentStreak: 0,
      bestStreak: 0,
      readinessEntries: [],
    });
    // frequency = ~35, streak = 0, readiness = 15
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.signals.sessions_per_week).toBeGreaterThanOrEqual(2.9);
  });

  it('deduplicates session dates', () => {
    const dates = ['2026-03-01', '2026-03-01', '2026-03-02'];
    const result = calculateConsistencyScore({
      sessionDatesLast30: dates,
      currentStreak: 0,
      bestStreak: 0,
      readinessEntries: [],
    });
    expect(result.signals.sessions_this_month).toBe(2);
  });

  it('rewards high streak', () => {
    const result = calculateConsistencyScore({
      sessionDatesLast30: ['2026-03-01'],
      currentStreak: 30,
      bestStreak: 30,
      readinessEntries: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(45); // 35 streak + ~4 freq + 15 readiness
  });

  it('gives partial readiness commitment score', () => {
    const result = calculateConsistencyScore({
      sessionDatesLast30: ['2026-03-01'],
      currentStreak: 0,
      bestStreak: 0,
      readinessEntries: [
        { score: 30, zone: 'rest' },
        { score: 80, zone: 'peak' },
        { score: 50, zone: 'moderate' },
      ],
    });
    // 2/3 moderate+rest entries
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('caps at 100', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
    const result = calculateConsistencyScore({
      sessionDatesLast30: dates,
      currentStreak: 30,
      bestStreak: 30,
      readinessEntries: [
        { score: 30, zone: 'rest' },
        { score: 80, zone: 'peak' },
      ],
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// PROGRESSION SCORE TESTS
// ============================================================================

describe('calculateProgressionScore', () => {
  it('gives neutral scores with no data', () => {
    const result = calculateProgressionScore({
      allSessions60d: [],
      programs: [],
      goals: [],
    });
    // slopeScore=20 (baseline), programScore=15, goalScore=15 = 50
    expect(result.score).toBe(50);
    expect(result.is_building).toBe(true);
  });

  it('gives higher score for positive weight slope', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 100, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 105, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-15', best_weight_lbs: 110, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-22', best_weight_lbs: 115, total_volume_lbs: 1000 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [],
      goals: [],
    });
    expect(result.score).toBeGreaterThan(50);
    expect(result.signals.avg_weight_slope_per_session).toBeGreaterThan(0);
  });

  it('gives lower score for negative weight slope', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 110, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 105, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-15', best_weight_lbs: 100, total_volume_lbs: 1000 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [],
      goals: [],
    });
    expect(result.score).toBeLessThan(50);
  });

  it('rewards program completion', () => {
    const noProg = calculateProgressionScore({
      allSessions60d: [],
      programs: [],
      goals: [],
    });
    const fullProg = calculateProgressionScore({
      allSessions60d: [],
      programs: [{ sessions_completed: 12, sessions_total: 12 }],
      goals: [],
    });
    expect(fullProg.score).toBeGreaterThan(noProg.score);
  });

  it('rewards goal achievement', () => {
    const noGoals = calculateProgressionScore({
      allSessions60d: [],
      programs: [],
      goals: [],
    });
    const achieved = calculateProgressionScore({
      allSessions60d: [],
      programs: [],
      goals: [{ is_achieved: true }, { is_achieved: true }],
    });
    expect(achieved.score).toBeGreaterThan(noGoals.score);
  });

  it('counts machines with positive trend', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 100, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 110, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-15', best_weight_lbs: 120, total_volume_lbs: 1000 },
      { machine_id: 'm2', session_date: '2026-02-01', best_weight_lbs: 50, total_volume_lbs: 500 },
      { machine_id: 'm2', session_date: '2026-02-08', best_weight_lbs: 45, total_volume_lbs: 500 },
      { machine_id: 'm2', session_date: '2026-02-15', best_weight_lbs: 40, total_volume_lbs: 500 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [],
      goals: [],
    });
    expect(result.signals.machines_with_positive_trend).toBe(1);
  });
});

describe('calculateWeightSlope', () => {
  it('returns 0 for single session', () => {
    expect(calculateWeightSlope([{ session_date: '2026-03-01', best_weight_lbs: 100 }])).toBe(0);
  });

  it('returns positive slope for increasing weights', () => {
    const sessions = [
      { session_date: '2026-03-01', best_weight_lbs: 100 },
      { session_date: '2026-03-08', best_weight_lbs: 110 },
      { session_date: '2026-03-15', best_weight_lbs: 120 },
    ];
    expect(calculateWeightSlope(sessions)).toBe(10);
  });

  it('returns negative slope for decreasing weights', () => {
    const sessions = [
      { session_date: '2026-03-01', best_weight_lbs: 120 },
      { session_date: '2026-03-08', best_weight_lbs: 110 },
      { session_date: '2026-03-15', best_weight_lbs: 100 },
    ];
    expect(calculateWeightSlope(sessions)).toBe(-10);
  });

  it('returns 0 for flat weights', () => {
    const sessions = [
      { session_date: '2026-03-01', best_weight_lbs: 100 },
      { session_date: '2026-03-08', best_weight_lbs: 100 },
      { session_date: '2026-03-15', best_weight_lbs: 100 },
    ];
    expect(calculateWeightSlope(sessions)).toBe(0);
  });
});

// ============================================================================
// MINDSET SCORE TESTS
// ============================================================================

describe('calculateMindsetScore', () => {
  it('gives neutral score with no data', () => {
    const result = calculateMindsetScore({
      allSets: [],
      checkIns: [],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 0,
    });
    // rpeScore=0, checkInScore=12, goalScore=0, socialScore=0 = 12
    expect(result.score).toBe(12);
    expect(result.is_building).toBe(true);
  });

  it('rewards RPE logging', () => {
    const result = calculateMindsetScore({
      allSets: [{ rpe: 7 }, { rpe: 8 }, { rpe: null }, { rpe: 9 }],
      checkIns: [],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 5,
    });
    // 3/4 = 75% RPE rate => ~19 pts
    expect(result.signals.rpe_logging_rate).toBe(75);
    expect(result.score).toBeGreaterThan(12);
  });

  it('rewards check-in replies', () => {
    const result = calculateMindsetScore({
      allSets: [],
      checkIns: [{ member_replied: true }, { member_replied: true }, { member_replied: false }],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 5,
    });
    // 2/3 reply rate => ~17 pts
    expect(result.signals.check_in_reply_rate).toBe(67);
  });

  it('rewards goal setting and achievement', () => {
    const result = calculateMindsetScore({
      allSets: [],
      checkIns: [],
      goalsSet: 5,
      goalsAchieved: 2,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 5,
    });
    // goalSetScore = min(15, 5*3) = 15, goalAchieveScore = min(10, 2*5) = 10 => 25
    expect(result.score).toBeGreaterThanOrEqual(37); // 25 goals + 12 checkin
  });

  it('rewards social engagement', () => {
    const result = calculateMindsetScore({
      allSets: [],
      checkIns: [],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 10,
      shareCount: 2,
      sessionCount: 5,
    });
    // socialScore = min(25, 10*2 + 2*3) = min(25, 26) = 25
    expect(result.score).toBeGreaterThanOrEqual(37); // 25 social + 12 checkin
  });

  it('caps at 100', () => {
    const result = calculateMindsetScore({
      allSets: Array.from({ length: 50 }, () => ({ rpe: 8 })),
      checkIns: Array.from({ length: 4 }, () => ({ member_replied: true })),
      goalsSet: 5,
      goalsAchieved: 2,
      reactionCount: 15,
      shareCount: 5,
      sessionCount: 10,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// ARCHETYPE DETERMINATION TESTS
// ============================================================================

describe('determineArchetype', () => {
  it('returns Complete Athlete when all dimensions >= 70', () => {
    const scores: DNAScores = { power: 75, consistency: 80, progression: 70, balance: 72, mindset: 71 };
    expect(determineArchetype(scores).id).toBe('complete_athlete');
  });

  it('returns Newcomer when average < 30', () => {
    const scores: DNAScores = { power: 10, consistency: 20, progression: 15, balance: 25, mindset: 10 };
    expect(determineArchetype(scores).id).toBe('newcomer');
  });

  it('returns Rising Athlete when 30 <= avg < 55 and no dimension >= 70', () => {
    const scores: DNAScores = { power: 45, consistency: 40, progression: 42, balance: 38, mindset: 40 };
    expect(determineArchetype(scores).id).toBe('rising_athlete');
  });

  it('returns Iron Regular when consistency >= 70 and mindset >= 65', () => {
    const scores: DNAScores = { power: 50, consistency: 75, progression: 50, balance: 50, mindset: 70 };
    expect(determineArchetype(scores).id).toBe('iron_regular');
  });

  it('returns Dedicated Grinder when consistency >= 70 and progression >= 65', () => {
    const scores: DNAScores = { power: 50, consistency: 75, progression: 70, balance: 50, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('dedicated_grinder');
  });

  it('returns Specialist when power >= 70 and balance < 45', () => {
    const scores: DNAScores = { power: 80, consistency: 50, progression: 50, balance: 40, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('specialist');
  });

  it('returns Warrior when power >= 65 and mindset >= 65 and consistency < 50', () => {
    const scores: DNAScores = { power: 70, consistency: 40, progression: 50, balance: 50, mindset: 70 };
    expect(determineArchetype(scores).id).toBe('warrior');
  });

  it('returns Climber when progression >= 70 and power < 55', () => {
    const scores: DNAScores = { power: 45, consistency: 50, progression: 75, balance: 50, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('climber');
  });

  it('returns Sporadic Climber when progression >= 65 and consistency < 45', () => {
    const scores: DNAScores = { power: 60, consistency: 40, progression: 68, balance: 60, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('sporadic_climber');
  });

  it('returns Foundation Builder when balance >= 70 and power < 50', () => {
    const scores: DNAScores = { power: 40, consistency: 50, progression: 50, balance: 75, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('foundation_builder');
  });

  it('returns Explorer when balance >= 65 and mindset >= 65', () => {
    const scores: DNAScores = { power: 50, consistency: 50, progression: 50, balance: 70, mindset: 70 };
    expect(determineArchetype(scores).id).toBe('explorer');
  });

  it('returns Streak Hunter when consistency >= 65 and power < 45', () => {
    const scores: DNAScores = { power: 40, consistency: 70, progression: 50, balance: 50, mindset: 50 };
    expect(determineArchetype(scores).id).toBe('streak_hunter');
  });

  it('defaults to Rising Athlete when no specific pattern matches', () => {
    const scores: DNAScores = { power: 55, consistency: 55, progression: 55, balance: 55, mindset: 55 };
    expect(determineArchetype(scores).id).toBe('rising_athlete');
  });

  // Priority order tests
  it('Complete Athlete takes priority over Iron Regular', () => {
    const scores: DNAScores = { power: 75, consistency: 80, progression: 75, balance: 75, mindset: 75 };
    expect(determineArchetype(scores).id).toBe('complete_athlete');
  });

  it('Iron Regular takes priority over Dedicated Grinder when both match', () => {
    // consistency=75, mindset=70, progression=70 => both iron_regular and dedicated_grinder match
    const scores: DNAScores = { power: 50, consistency: 75, progression: 70, balance: 50, mindset: 70 };
    expect(determineArchetype(scores).id).toBe('iron_regular');
  });

  // Boundary tests
  it('boundary: avg exactly 30 is Rising Athlete, not Newcomer', () => {
    // avg = (30+30+30+30+30)/5 = 30
    const scores: DNAScores = { power: 30, consistency: 30, progression: 30, balance: 30, mindset: 30 };
    expect(determineArchetype(scores).id).toBe('rising_athlete');
  });

  it('boundary: avg exactly 29.x is Newcomer', () => {
    const scores: DNAScores = { power: 29, consistency: 29, progression: 29, balance: 29, mindset: 29 };
    expect(determineArchetype(scores).id).toBe('newcomer');
  });

  it('boundary: all zeros returns Newcomer', () => {
    const scores: DNAScores = { power: 0, consistency: 0, progression: 0, balance: 0, mindset: 0 };
    expect(determineArchetype(scores).id).toBe('newcomer');
  });
});

// ============================================================================
// ARCHETYPE CONSTANTS TESTS
// ============================================================================

describe('ARCHETYPES', () => {
  it('has exactly 12 archetypes', () => {
    expect(Object.keys(ARCHETYPES)).toHaveLength(12);
  });

  it('all archetypes have required fields', () => {
    for (const [key, archetype] of Object.entries(ARCHETYPES)) {
      expect(archetype.id).toBe(key);
      expect(archetype.name).toBeTruthy();
      expect(archetype.description).toBeTruthy();
      expect(archetype.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(archetype.icon).toBeTruthy();
      expect(archetype.coaching_focus).toBeTruthy();
    }
  });
});

describe('ARCHETYPE_PRESTIGE', () => {
  it('covers all 12 archetypes', () => {
    for (const key of Object.keys(ARCHETYPES)) {
      expect(ARCHETYPE_PRESTIGE[key]).toBeDefined();
    }
  });

  it('complete_athlete has highest prestige', () => {
    const max = Math.max(...Object.values(ARCHETYPE_PRESTIGE));
    expect(ARCHETYPE_PRESTIGE.complete_athlete).toBe(max);
  });

  it('newcomer has lowest prestige', () => {
    const min = Math.min(...Object.values(ARCHETYPE_PRESTIGE));
    expect(ARCHETYPE_PRESTIGE.newcomer).toBe(min);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  it('power: single session with no weight', () => {
    const result = calculatePowerScore({
      recentSessions: [{ machine_id: null, best_weight_lbs: 0, total_volume_lbs: 0 }],
      olderSessions: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.is_building).toBe(true);
  });

  it('consistency: all sessions on same day', () => {
    const result = calculateConsistencyScore({
      sessionDatesLast30: ['2026-03-15', '2026-03-15', '2026-03-15'],
      currentStreak: 1,
      bestStreak: 1,
      readinessEntries: [],
    });
    expect(result.signals.sessions_this_month).toBe(1);
  });

  it('progression: machines with < 3 sessions are skipped', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 100, total_volume_lbs: 500 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 110, total_volume_lbs: 500 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [],
      goals: [],
    });
    // Slope can't be calculated with < 3 sessions, so uses baseline
    expect(result.signals.machines_with_positive_trend).toBe(0);
  });

  it('mindset: all sets have null RPE', () => {
    const result = calculateMindsetScore({
      allSets: [{ rpe: null }, { rpe: null }],
      checkIns: [],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 2,
    });
    expect(result.signals.rpe_logging_rate).toBe(0);
  });

  it('progression: program with 0 total sessions', () => {
    const result = calculateProgressionScore({
      allSessions60d: [],
      programs: [{ sessions_completed: 0, sessions_total: 0 }],
      goals: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('progression: single goal does not trigger goal scoring', () => {
    const result = calculateProgressionScore({
      allSessions60d: [],
      programs: [],
      goals: [{ is_achieved: true }],
    });
    // < 2 goals => neutral goalScore = 15
    expect(result.score).toBe(50); // 20 slope + 15 program + 15 goal
  });
});

// ============================================================================
// SCORE CLAMPING TESTS — negative and over-100 boundary
// ============================================================================

describe('score clamping (0-100 boundaries)', () => {
  it('power score never goes below 0 with zero-weight sessions', () => {
    const result = calculatePowerScore({
      recentSessions: Array.from({ length: 10 }, () => ({
        machine_id: 'm1',
        best_weight_lbs: 0,
        total_volume_lbs: 0,
      })),
      olderSessions: [{ machine_id: 'm1', best_weight_lbs: 200 }],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('consistency score stays in 0-100 with extreme streak and frequency', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
    const result = calculateConsistencyScore({
      sessionDatesLast30: dates,
      currentStreak: 365,
      bestStreak: 365,
      readinessEntries: Array.from({ length: 30 }, () => ({ score: 95, zone: 'peak' as const })),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('consistency score stays >= 0 with no data at all', () => {
    const result = calculateConsistencyScore({
      sessionDatesLast30: [],
      currentStreak: 0,
      bestStreak: 0,
      readinessEntries: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('progression score stays in 0-100 with extreme negative slope', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 300, total_volume_lbs: 5000 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 100, total_volume_lbs: 500 },
      { machine_id: 'm1', session_date: '2026-02-15', best_weight_lbs: 10, total_volume_lbs: 50 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [],
      goals: Array.from({ length: 10 }, () => ({ is_achieved: false })),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('progression score stays <= 100 with extreme positive slope and all goals achieved', () => {
    const sessions = [
      { machine_id: 'm1', session_date: '2026-02-01', best_weight_lbs: 10, total_volume_lbs: 100 },
      { machine_id: 'm1', session_date: '2026-02-08', best_weight_lbs: 100, total_volume_lbs: 1000 },
      { machine_id: 'm1', session_date: '2026-02-15', best_weight_lbs: 500, total_volume_lbs: 5000 },
    ];
    const result = calculateProgressionScore({
      allSessions60d: sessions,
      programs: [{ sessions_completed: 20, sessions_total: 20 }],
      goals: Array.from({ length: 10 }, () => ({ is_achieved: true })),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('mindset score stays >= 0 with zero everything', () => {
    const result = calculateMindsetScore({
      allSets: [],
      checkIns: [],
      goalsSet: 0,
      goalsAchieved: 0,
      reactionCount: 0,
      shareCount: 0,
      sessionCount: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('mindset score stays <= 100 with max everything', () => {
    const result = calculateMindsetScore({
      allSets: Array.from({ length: 100 }, () => ({ rpe: 9 })),
      checkIns: Array.from({ length: 20 }, () => ({ member_replied: true })),
      goalsSet: 50,
      goalsAchieved: 50,
      reactionCount: 100,
      shareCount: 50,
      sessionCount: 100,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('determineArchetype handles all-100 scores', () => {
    const scores: DNAScores = { power: 100, consistency: 100, progression: 100, balance: 100, mindset: 100 };
    const result = determineArchetype(scores);
    expect(result.id).toBe('complete_athlete');
  });
});
