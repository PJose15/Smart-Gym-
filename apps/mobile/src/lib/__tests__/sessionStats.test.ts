/**
 * Tests for sessionStats — parsing workout_sessions.sets JSONB and
 * computing display-unit trends / strength curve.
 */
import {
  parseSessionSets,
  setsVolume,
  volumeTrendPts,
  e1rmTrendPts,
  weightTrendPts,
  weeklyVolumePts,
  strengthCurvePts,
} from '../sessionStats';
import type { ParsedSet, SessionForStats } from '../sessionStats';

const KG_PER_LB = 0.45359237;

function set(weight: number, reps: number, set_number = 1, rpe: number | null = null): ParsedSet {
  return { set_number, weight, reps, rpe };
}

describe('parseSessionSets', () => {
  it('parses well-formed JSONB entries in lbs', () => {
    const raw = [
      { set_number: 1, weight_lbs: 100, reps: 10, rpe: 8, notes: null, logged_at: 'x' },
      { set_number: 2, weight_lbs: 120, reps: 8, rpe: null, notes: null, logged_at: 'x' },
    ];
    const parsed = parseSessionSets(raw, 'lbs');
    expect(parsed).toEqual([
      { set_number: 1, weight: 100, reps: 10, rpe: 8 },
      { set_number: 2, weight: 120, reps: 8, rpe: null },
    ]);
  });

  it('converts lbs → kg for kg display unit', () => {
    const parsed = parseSessionSets([{ set_number: 1, weight_lbs: 100, reps: 5 }], 'kg');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].weight).toBeCloseTo(100 * KG_PER_LB, 5);
  });

  it('returns [] for non-array input', () => {
    expect(parseSessionSets(null, 'lbs')).toEqual([]);
    expect(parseSessionSets(undefined, 'lbs')).toEqual([]);
    expect(parseSessionSets('garbage', 'lbs')).toEqual([]);
    expect(parseSessionSets({ weight_lbs: 100, reps: 5 }, 'lbs')).toEqual([]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const raw = [
      null,
      'string',
      42,
      [],
      { set_number: 1 }, // no weight/reps
      { set_number: 2, weight_lbs: 'NaNish', reps: 5 },
      { set_number: 3, weight_lbs: -10, reps: 5 }, // negative weight
      { set_number: 4, weight_lbs: 100, reps: -1 }, // negative reps
      { set_number: 5, weight_lbs: 135, reps: 5, rpe: 7.5 },
    ];
    const parsed = parseSessionSets(raw, 'lbs');
    expect(parsed).toEqual([{ set_number: 5, weight: 135, reps: 5, rpe: 7.5 }]);
  });

  it('coerces numeric strings and assigns fallback set numbers', () => {
    const raw = [
      { weight_lbs: '95', reps: '12' }, // no set_number → positional fallback
      { set_number: '2', weight_lbs: 105, reps: 10 },
    ];
    const parsed = parseSessionSets(raw, 'lbs');
    expect(parsed).toEqual([
      { set_number: 1, weight: 95, reps: 12, rpe: null },
      { set_number: 2, weight: 105, reps: 10, rpe: null },
    ]);
  });

  it('sorts by set_number', () => {
    const raw = [
      { set_number: 3, weight_lbs: 100, reps: 5 },
      { set_number: 1, weight_lbs: 90, reps: 8 },
      { set_number: 2, weight_lbs: 95, reps: 6 },
    ];
    expect(parseSessionSets(raw, 'lbs').map((s) => s.set_number)).toEqual([1, 2, 3]);
  });
});

describe('setsVolume', () => {
  it('sums weight × reps', () => {
    expect(setsVolume([set(100, 10), set(120, 8, 2)])).toBe(1960);
  });

  it('returns 0 for empty sets', () => {
    expect(setsVolume([])).toBe(0);
  });
});

describe('trend points', () => {
  const sessions: SessionForStats[] = [
    { date: '2026-09-03', sets: [set(120, 5), set(120, 5, 2)] },
    { date: '2026-09-01', sets: [set(100, 10)] },
  ];

  it('volumeTrendPts sorts ascending by date with per-session volume', () => {
    expect(volumeTrendPts(sessions)).toEqual([
      { date: '2026-09-01', value: 1000 },
      { date: '2026-09-03', value: 1200 },
    ]);
  });

  it('e1rmTrendPts takes best set e1rm per session and drops zero points', () => {
    const withEmpty: SessionForStats[] = [...sessions, { date: '2026-09-05', sets: [] }];
    const pts = e1rmTrendPts(withEmpty);
    expect(pts.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-03']);
    // Brzycki: 100 × 36 / (37 - 10) ≈ 133.3; 120 × 36 / 32 = 135
    expect(pts[0].value).toBeCloseTo((100 * 36) / 27, 1);
    expect(pts[1].value).toBeCloseTo(135, 1);
  });

  it('weightTrendPts takes max weight per session and drops zero points', () => {
    const withZero: SessionForStats[] = [...sessions, { date: '2026-09-05', sets: [set(0, 10)] }];
    expect(weightTrendPts(withZero)).toEqual([
      { date: '2026-09-01', value: 100 },
      { date: '2026-09-03', value: 120 },
    ]);
  });
});

describe('weeklyVolumePts', () => {
  it('groups session volume by ISO week', () => {
    const sessions: SessionForStats[] = [
      // 2026-08-31 (Mon) and 2026-09-03 (Thu) share ISO week 2026-W35
      { date: '2026-08-31', sets: [set(100, 10)] },
      { date: '2026-09-03', sets: [set(100, 5)] },
      // 2026-09-07 (Mon) is the following week
      { date: '2026-09-07', sets: [set(200, 5)] },
    ];
    expect(weeklyVolumePts(sessions)).toEqual([
      { date: '2026-W35', value: 1500 },
      { date: '2026-W36', value: 1000 },
    ]);
  });

  it('rounds aggregated volume and handles empty input', () => {
    expect(weeklyVolumePts([])).toEqual([]);
    const pts = weeklyVolumePts([{ date: '2026-09-01', sets: [set(45.3592, 3)] }]);
    expect(pts).toHaveLength(1);
    expect(Number.isInteger(pts[0].value)).toBe(true);
  });
});

describe('strengthCurvePts', () => {
  it('buckets sets into canonical rep ranges', () => {
    const sets = [
      set(200, 2), // 1-3
      set(180, 5), // 4-6
      set(150, 8), // 7-10
      set(120, 12), // 11-15
      set(80, 20), // 16+
    ];
    const curve = strengthCurvePts(sets);
    expect(curve.map((c) => c.repRange)).toEqual(['1-3', '4-6', '7-10', '11-15', '16+']);
    expect(curve.every((c) => c.setCount === 1)).toBe(true);
  });

  it('keeps the best weight/1RM per bucket and counts sets', () => {
    const curve = strengthCurvePts([set(100, 5), set(110, 6, 2), set(90, 4, 3)]);
    expect(curve).toHaveLength(1);
    expect(curve[0].repRange).toBe('4-6');
    expect(curve[0].bestWeight).toBe(110);
    expect(curve[0].setCount).toBe(3);
    // best1RM from 110×6: 110 × 36 / 31 ≈ 127.7
    expect(curve[0].best1RM).toBeCloseTo((110 * 36) / 31, 1);
  });

  it('skips zero-weight / zero-rep sets and omits empty buckets', () => {
    const curve = strengthCurvePts([set(0, 5), set(100, 0, 2), set(100, 10, 3)]);
    expect(curve).toHaveLength(1);
    expect(curve[0].repRange).toBe('7-10');
  });
});
