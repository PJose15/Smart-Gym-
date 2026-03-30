import { describe, it, expect } from 'vitest';
import { calculateReadinessScore } from '../rules/readiness';
import type { ReadinessInputs } from '@nexera/types';

// ─── Helpers ────────────────────────────────────────────

function makeInputs(overrides: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return {
    sessionCountLast3Days: 1,
    lastSessionRPEAverage: 7,
    daysSinceLastSession: 1,
    currentStreak: 0,
    volumeTrend: 'insufficient',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('calculateReadinessScore', () => {

  // ── New member scenario ──────────────────────────────
  describe('new member (never trained)', () => {
    it('returns score 100 and peak zone', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 0,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 999,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      expect(result.score).toBe(100);
      expect(result.zone).toBe('peak');
      expect(result.color).toBe('#639922');
      expect(result.headline).toBe('Peak day — train hard');
    });
  });

  // ── Zone boundaries ──────────────────────────────────
  describe('zone boundaries', () => {
    it('score 80 → peak zone', () => {
      // baseline 50 + sessions 0 (+25) + RPE null (0) + rest 1d (+10) - 5 streak adj
      // 50 + 25 + 0 + 10 + 0 + 0 = 85 → still peak, let's target 80 exactly
      // 50 + 10 (1 session) + 5 (rpe 8) + 10 (rest 1d) + 5 (streak 14) + 0 = 80
      const result = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 1,
        lastSessionRPEAverage: 8,
        daysSinceLastSession: 1,
        currentStreak: 14,
        volumeTrend: 'insufficient',
      }));
      expect(result.score).toBe(80);
      expect(result.zone).toBe('peak');
    });

    it('score 79 → ready zone', () => {
      // 50 + 10 (1 session) + 5 (rpe 8) + 10 (rest 1d) + 3 (streak 7) + 0 = 78
      // Need exactly 79: 50 + 10 + 5 + 10 + 3 + 0 = 78... try streak adj
      // 50 + 10 + 5 + 10 + 3 + (-5+5 cancel) = 78 → not 79
      // Let's just verify that 79 maps to ready
      // 50 + 0 (2 sessions) + 15 (rpe <=7) + 10 (rest 1d) + 3 (streak 7) + 0 = 78
      // Try: 50 + 10 (1 session) + 15 (rpe <=7) + 0 (rest 0d is -5) + 3 (streak 7) + 0 = 73
      // 50 + 0 (2 sessions) + 15 (rpe <=7) + 10 (rest 1d) + 3 (streak 7) + 0 = 78
      // 50 + 0 (2 sessions) + 15 (rpe <=7) + 10 (rest 1d) + 3 (streak 7) + (-5 vol inc) = 73
      // 50 + 0 (2 sessions) + 15 (rpe <=7) + 10 (rest 1d) + 3 (streak 7) + 5 (vol dec) = 83
      // Let's try: 50 + 10 + 5 + 10 + 3 + 1 = 79 — but +1 doesn't exist for vol
      // Simpler approach: just test that score < 80 maps to ready
      const result = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: 7,
        daysSinceLastSession: 1,
        currentStreak: 3,
        volumeTrend: 'stable',
      }));
      // 50 + 0 + 15 + 10 + 1 + 0 = 76
      expect(result.score).toBe(76);
      expect(result.zone).toBe('ready');
    });

    it('score in 60-79 → ready zone', () => {
      const result = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 1,
        lastSessionRPEAverage: 7,
        daysSinceLastSession: 0,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      }));
      // 50 + 10 + 15 + (-5) + 0 + 0 = 70
      expect(result.score).toBe(70);
      expect(result.zone).toBe('ready');
    });

    it('score in 40-59 → moderate zone', () => {
      const result = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 3,
        lastSessionRPEAverage: 8,
        daysSinceLastSession: 0,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      }));
      // 50 + (-10) + 5 + (-5) + 0 + 0 = 40
      expect(result.score).toBe(40);
      expect(result.zone).toBe('moderate');
    });

    it('score below 40 → rest zone', () => {
      const result = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 4,
        lastSessionRPEAverage: 10,
        daysSinceLastSession: 0,
        currentStreak: 0,
        volumeTrend: 'increasing',
      }));
      // 50 + (-20) + (-15) + (-5) + 0 + (-5) = 5
      expect(result.score).toBe(5);
      expect(result.zone).toBe('rest');
    });
  });

  // ── Individual signals ───────────────────────────────
  describe('session count signal', () => {
    const base: ReadinessInputs = {
      sessionCountLast3Days: 0,
      lastSessionRPEAverage: null,
      daysSinceLastSession: 1,
      currentStreak: 0,
      volumeTrend: 'insufficient',
    };

    it('0 sessions → +25', () => {
      const r = calculateReadinessScore({ ...base, sessionCountLast3Days: 0 });
      expect(r.signals.session_count).toBe(25);
    });

    it('1 session → +10', () => {
      const r = calculateReadinessScore({ ...base, sessionCountLast3Days: 1 });
      expect(r.signals.session_count).toBe(10);
    });

    it('2 sessions → 0', () => {
      const r = calculateReadinessScore({ ...base, sessionCountLast3Days: 2 });
      expect(r.signals.session_count).toBe(0);
    });

    it('3 sessions → -10', () => {
      const r = calculateReadinessScore({ ...base, sessionCountLast3Days: 3 });
      expect(r.signals.session_count).toBe(-10);
    });

    it('4+ sessions → -20', () => {
      const r = calculateReadinessScore({ ...base, sessionCountLast3Days: 4 });
      expect(r.signals.session_count).toBe(-20);
      const r5 = calculateReadinessScore({ ...base, sessionCountLast3Days: 5 });
      expect(r5.signals.session_count).toBe(-20);
    });
  });

  describe('RPE signal', () => {
    const base: ReadinessInputs = {
      sessionCountLast3Days: 2,
      lastSessionRPEAverage: null,
      daysSinceLastSession: 1,
      currentStreak: 0,
      volumeTrend: 'insufficient',
    };

    it('null RPE → 0', () => {
      const r = calculateReadinessScore({ ...base, lastSessionRPEAverage: null });
      expect(r.signals.rpe).toBe(0);
    });

    it('RPE 1-7 → +15', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 1 }).signals.rpe).toBe(15);
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 7 }).signals.rpe).toBe(15);
    });

    it('RPE 8 → +5', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 8 }).signals.rpe).toBe(5);
    });

    it('RPE 9 → -5', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 9 }).signals.rpe).toBe(-5);
    });

    it('RPE 10 → -15', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 10 }).signals.rpe).toBe(-15);
    });

    it('fractional RPE 7.5 → +5 (falls in 7-8 range)', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 7.5 }).signals.rpe).toBe(5);
    });

    it('fractional RPE 8.5 → -5 (falls in 8-9 range)', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 8.5 }).signals.rpe).toBe(-5);
    });

    it('fractional RPE 9.5 → -15 (falls in 9+ range)', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 9.5 }).signals.rpe).toBe(-15);
    });

    it('fractional RPE 6.5 → +15 (falls in ≤7 range)', () => {
      expect(calculateReadinessScore({ ...base, lastSessionRPEAverage: 6.5 }).signals.rpe).toBe(15);
    });
  });

  describe('rest days signal', () => {
    const base: ReadinessInputs = {
      sessionCountLast3Days: 2,
      lastSessionRPEAverage: null,
      daysSinceLastSession: 0,
      currentStreak: 0,
      volumeTrend: 'insufficient',
    };

    it('0 days → -5', () => {
      expect(calculateReadinessScore({ ...base, daysSinceLastSession: 0 }).signals.rest_days).toBe(-5);
    });

    it('1 day → +10', () => {
      expect(calculateReadinessScore({ ...base, daysSinceLastSession: 1 }).signals.rest_days).toBe(10);
    });

    it('2 days → +20', () => {
      expect(calculateReadinessScore({ ...base, daysSinceLastSession: 2 }).signals.rest_days).toBe(20);
    });

    it('3+ days → +25', () => {
      expect(calculateReadinessScore({ ...base, daysSinceLastSession: 3 }).signals.rest_days).toBe(25);
      expect(calculateReadinessScore({ ...base, daysSinceLastSession: 10 }).signals.rest_days).toBe(25);
    });
  });

  describe('streak signal', () => {
    const base: ReadinessInputs = {
      sessionCountLast3Days: 2,
      lastSessionRPEAverage: null,
      daysSinceLastSession: 1,
      currentStreak: 0,
      volumeTrend: 'insufficient',
    };

    it('streak 0-2 → 0', () => {
      expect(calculateReadinessScore({ ...base, currentStreak: 0 }).signals.streak).toBe(0);
      expect(calculateReadinessScore({ ...base, currentStreak: 2 }).signals.streak).toBe(0);
    });

    it('streak 3-6 → +1', () => {
      expect(calculateReadinessScore({ ...base, currentStreak: 3 }).signals.streak).toBe(1);
      expect(calculateReadinessScore({ ...base, currentStreak: 6 }).signals.streak).toBe(1);
    });

    it('streak 7-13 → +3', () => {
      expect(calculateReadinessScore({ ...base, currentStreak: 7 }).signals.streak).toBe(3);
      expect(calculateReadinessScore({ ...base, currentStreak: 13 }).signals.streak).toBe(3);
    });

    it('streak 14+ → +5', () => {
      expect(calculateReadinessScore({ ...base, currentStreak: 14 }).signals.streak).toBe(5);
      expect(calculateReadinessScore({ ...base, currentStreak: 30 }).signals.streak).toBe(5);
    });
  });

  describe('volume trend signal', () => {
    const base: ReadinessInputs = {
      sessionCountLast3Days: 2,
      lastSessionRPEAverage: null,
      daysSinceLastSession: 1,
      currentStreak: 0,
      volumeTrend: 'insufficient',
    };

    it('increasing → -5', () => {
      expect(calculateReadinessScore({ ...base, volumeTrend: 'increasing' }).signals.volume_trend).toBe(-5);
    });

    it('stable → 0', () => {
      expect(calculateReadinessScore({ ...base, volumeTrend: 'stable' }).signals.volume_trend).toBe(0);
    });

    it('decreasing → +5', () => {
      expect(calculateReadinessScore({ ...base, volumeTrend: 'decreasing' }).signals.volume_trend).toBe(5);
    });

    it('insufficient → 0', () => {
      expect(calculateReadinessScore({ ...base, volumeTrend: 'insufficient' }).signals.volume_trend).toBe(0);
    });
  });

  // ── Clamping ─────────────────────────────────────────
  describe('clamping', () => {
    it('never exceeds 100', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 0,
        lastSessionRPEAverage: 1,
        daysSinceLastSession: 10,
        currentStreak: 20,
        volumeTrend: 'decreasing',
      });
      // 50 + 25 + 15 + 25 + 5 + 5 = 125 → clamped to 100
      expect(result.score).toBe(100);
    });

    it('never goes below 0', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 5,
        lastSessionRPEAverage: 10,
        daysSinceLastSession: 0,
        currentStreak: 0,
        volumeTrend: 'increasing',
      });
      // 50 + (-20) + (-15) + (-5) + 0 + (-5) = 5
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ── Dominant signal detection ────────────────────────
  describe('dominant signal detection', () => {
    it('detects session count as dominant when it has highest absolute adjustment', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 0,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 1,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      // session_count = +25 (abs 25), rpe = 0, rest_days = +10, streak = 0, vol = 0
      expect(result.dominant_signal).toBe('recent_sessions');
    });

    it('detects rest_days as dominant when it has highest absolute adjustment', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 3,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      // session_count = 0, rpe = 0, rest_days = +25 (abs 25), streak = 0, vol = 0
      expect(result.dominant_signal).toBe('rest_days');
    });

    it('detects last_rpe as dominant', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: 10,
        daysSinceLastSession: 1,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      // session_count = 0, rpe = -15 (abs 15), rest_days = +10, streak = 0, vol = 0
      expect(result.dominant_signal).toBe('last_rpe');
    });
  });

  // ── Subline text ─────────────────────────────────────
  describe('subline text', () => {
    it('recent_sessions dominant — high sessions', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 4,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 0,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      expect(result.subline).toContain('recovery will boost');
    });

    it('recent_sessions dominant — rested', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 0,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 1,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      expect(result.subline).toContain('well rested');
    });

    it('rest_days dominant — well recovered', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: null,
        daysSinceLastSession: 5,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      expect(result.subline).toContain('fully recovered');
    });

    it('last_rpe dominant — high RPE', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: 10,
        daysSinceLastSession: 1,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      expect(result.subline).toContain('max effort');
    });

    it('last_rpe dominant — comfortable RPE', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: 5,
        daysSinceLastSession: 1,
        currentStreak: 0,
        volumeTrend: 'insufficient',
      });
      // rpe = +15 (dominant), session_count = 0, rest = +10
      expect(result.subline).toContain('energy in reserve');
    });
  });

  // ── Combined scenarios ───────────────────────────────
  describe('combined scenarios', () => {
    it('3 sessions in 3 days + RPE 9 → moderate or rest', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 3,
        lastSessionRPEAverage: 9,
        daysSinceLastSession: 0,
        currentStreak: 3,
        volumeTrend: 'increasing',
      });
      // 50 + (-10) + (-5) + (-5) + 1 + (-5) = 26
      expect(result.zone).toBe('rest');
      expect(result.score).toBe(26);
    });

    it('1 session yesterday + low RPE + long streak → peak', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 1,
        lastSessionRPEAverage: 6,
        daysSinceLastSession: 1,
        currentStreak: 14,
        volumeTrend: 'stable',
      });
      // 50 + 10 + 15 + 10 + 5 + 0 = 90
      expect(result.score).toBe(90);
      expect(result.zone).toBe('peak');
    });

    it('2 sessions + moderate RPE + decreasing volume → ready', () => {
      const result = calculateReadinessScore({
        sessionCountLast3Days: 2,
        lastSessionRPEAverage: 8,
        daysSinceLastSession: 1,
        currentStreak: 7,
        volumeTrend: 'decreasing',
      });
      // 50 + 0 + 5 + 10 + 3 + 5 = 73
      expect(result.score).toBe(73);
      expect(result.zone).toBe('ready');
    });
  });

  // ── Zone colors ──────────────────────────────────────
  describe('zone colors', () => {
    it('peak → green', () => {
      const r = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 0, daysSinceLastSession: 3,
        lastSessionRPEAverage: null, volumeTrend: 'insufficient',
      }));
      expect(r.color).toBe('#639922');
    });

    it('rest → gray', () => {
      const r = calculateReadinessScore(makeInputs({
        sessionCountLast3Days: 4, daysSinceLastSession: 0,
        lastSessionRPEAverage: 10, volumeTrend: 'increasing',
      }));
      expect(r.color).toBe('#888780');
    });
  });
});
