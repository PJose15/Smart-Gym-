/**
 * Pure helpers for reading canonical `workout_sessions` rows on mobile.
 *
 * The `sets` column is JSONB — an array of entries shaped like
 * `SessionSetEntry` in `sessionApi.ts` (weights stored in POUNDS, the
 * canonical unit). These helpers defensively parse that JSONB and convert
 * every weight into the member's display unit up front, so screens only
 * ever deal with display-unit numbers.
 *
 * All functions are pure (no React, no Supabase) so they run under the
 * node ts-jest test environment.
 */
import { estimate1RM, getISOWeekKey } from '@nexera/utils';
import type { TrendDataPoint } from '@nexera/utils';
import type { WeightUnit } from '@nexera/types';
import { convertFromLbs } from './feedLogic';

// ─── Parsed set / session shapes ────────────────────────────────────────────

export interface ParsedSet {
  set_number: number;
  /** Weight in the member's DISPLAY unit (already converted from lbs). */
  weight: number;
  reps: number;
  rpe: number | null;
}

export interface SessionForStats {
  /** Session calendar date, YYYY-MM-DD. */
  date: string;
  sets: ParsedSet[];
}

// ─── JSONB parsing ──────────────────────────────────────────────────────────

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Defensively parse a `workout_sessions.sets` JSONB value into display-unit
 * sets. Non-array input, non-object entries, and entries without usable
 * weight/reps are dropped. Result is sorted by set_number.
 */
export function parseSessionSets(raw: unknown, unit: WeightUnit): ParsedSet[] {
  if (!Array.isArray(raw)) return [];

  const out: ParsedSet[] = [];
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;

    const weightLbs = toFiniteNumber(rec.weight_lbs);
    const reps = toFiniteNumber(rec.reps);
    if (weightLbs == null || reps == null || weightLbs < 0 || reps < 0) continue;

    const setNumber = toFiniteNumber(rec.set_number);
    const rpe = toFiniteNumber(rec.rpe);

    out.push({
      set_number: setNumber ?? out.length + 1,
      weight: convertFromLbs(weightLbs, unit),
      reps: Math.round(reps),
      rpe,
    });
  }

  return out.sort((a, b) => a.set_number - b.set_number);
}

// ─── Per-set aggregates ─────────────────────────────────────────────────────

/** Total volume (sum of weight × reps) across sets, in display units. */
export function setsVolume(sets: ParsedSet[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

// ─── Per-session trend points (mirror @nexera/utils trend contracts) ────────

/** Session volume per date, sorted ascending. */
export function volumeTrendPts(sessions: SessionForStats[]): TrendDataPoint[] {
  return sessions
    .map((s) => ({ date: s.date.slice(0, 10), value: setsVolume(s.sets) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Best estimated 1RM per session, sorted ascending; zero-value points dropped. */
export function e1rmTrendPts(sessions: SessionForStats[]): TrendDataPoint[] {
  return sessions
    .map((s) => {
      let best = 0;
      for (const set of s.sets) {
        const e = estimate1RM(set.weight, set.reps);
        if (e > best) best = e;
      }
      return { date: s.date.slice(0, 10), value: best };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Best weight per session, sorted ascending; zero-value points dropped. */
export function weightTrendPts(sessions: SessionForStats[]): TrendDataPoint[] {
  return sessions
    .map((s) => {
      let best = 0;
      for (const set of s.sets) {
        if (set.weight > best) best = set.weight;
      }
      return { date: s.date.slice(0, 10), value: best };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Session dates like '2026-09-04' parse as UTC; anchor to local noon so
 * getISOWeekKey (local-time math) lands on the intended calendar day. */
function localNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d, 12);
}

/** Total volume grouped by ISO week ('YYYY-WXX'), sorted ascending. */
export function weeklyVolumePts(sessions: SessionForStats[]): TrendDataPoint[] {
  const weekMap = new Map<string, number>();
  for (const s of sessions) {
    const weekKey = getISOWeekKey(localNoon(s.date));
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + setsVolume(s.sets));
  }
  return Array.from(weekMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Strength curve (same rep buckets as @nexera/utils) ─────────────────────

export interface StrengthCurveBucket {
  repRange: string; // '1-3' | '4-6' | '7-10' | '11-15' | '16+'
  bestWeight: number;
  best1RM: number;
  setCount: number;
}

const REP_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '1-3', min: 1, max: 3 },
  { label: '4-6', min: 4, max: 6 },
  { label: '7-10', min: 7, max: 10 },
  { label: '11-15', min: 11, max: 15 },
  { label: '16+', min: 16, max: Infinity },
];

/** Best performance grouped by rep range, display units. */
export function strengthCurvePts(sets: ParsedSet[]): StrengthCurveBucket[] {
  const buckets = new Map<string, { bestWeight: number; best1RM: number; setCount: number }>();

  for (const set of sets) {
    if (set.weight <= 0 || set.reps <= 0) continue;
    const bucket = REP_BUCKETS.find((b) => set.reps >= b.min && set.reps <= b.max);
    if (!bucket) continue;

    const e1rm = estimate1RM(set.weight, set.reps);
    const existing = buckets.get(bucket.label);
    if (!existing) {
      buckets.set(bucket.label, { bestWeight: set.weight, best1RM: e1rm, setCount: 1 });
    } else {
      existing.bestWeight = Math.max(existing.bestWeight, set.weight);
      existing.best1RM = Math.max(existing.best1RM, e1rm);
      existing.setCount++;
    }
  }

  return REP_BUCKETS.filter((b) => buckets.has(b.label)).map((b) => ({
    repRange: b.label,
    ...buckets.get(b.label)!,
  }));
}
