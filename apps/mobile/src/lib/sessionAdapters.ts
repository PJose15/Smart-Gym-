/**
 * sessionAdapters — converts canonical `workout_sessions` rows (weights in
 * POUNDS, sets as a JSONB array, one row per member+machine+day) into the
 * kg-shaped inputs that @nexera/ai-assist expects (WorkoutRecord for
 * guardrails, MemberContextWorkout for coaching).
 *
 * The lbs→kg conversion happens HERE and only here — screens never touch
 * weight_kg directly; they pass raw session rows through these adapters.
 */
import type { WorkoutSet } from '@nexera/types';
import type { WorkoutRecord } from '@nexera/ai-assist';
import { convertFromLbs } from './feedLogic';

/** Machine columns joined via `machines(name, muscle_groups)`. */
export interface JoinedMachine {
  name?: string | null;
  muscle_groups?: string[] | null;
}

/** Minimal row shape for muscle-gap computation (session_date + machine). */
export interface SessionMachineRow {
  session_date: string;
  /** Supabase FK join — object for a to-one join, but tolerate array shape. */
  machines?: JoinedMachine | JoinedMachine[] | null;
}

/** The columns the home screen selects for guardrails/coaching adapters. */
export interface SessionRow extends SessionMachineRow {
  id: string;
  machine_id: string | null;
  created_at: string;
  completed_at: string | null;
  /** JSONB array of { set_number, weight_lbs, reps, rpe, notes, logged_at }. */
  sets: unknown;
}

function joinedMachine(row: SessionMachineRow): JoinedMachine | null {
  const m = row.machines;
  if (!m) return null;
  return Array.isArray(m) ? m[0] ?? null : m;
}

interface RawSetEntry {
  set_number?: number;
  weight_lbs?: number;
  reps?: number;
  rpe?: number | null;
  notes?: string | null;
  logged_at?: string;
}

/**
 * Parse a session's JSONB `sets` into ai-assist WorkoutSet[] — the lbs→kg
 * boundary. Synthetic ids since JSONB set entries have no row identity.
 */
function parseSets(row: SessionRow): WorkoutSet[] {
  const raw = Array.isArray(row.sets) ? (row.sets as RawSetEntry[]) : [];
  return raw.map((s, i) => {
    const setNumber = typeof s.set_number === 'number' ? s.set_number : i + 1;
    return {
      id: `${row.id}-${setNumber}`,
      workout_exercise_id: row.id,
      set_number: setNumber,
      reps: Number(s.reps) || 0,
      weight_kg: convertFromLbs(Number(s.weight_lbs) || 0, 'kg'),
      rpe: typeof s.rpe === 'number' ? s.rpe : null,
      notes: s.notes ?? undefined,
      logged_at: s.logged_at ?? row.created_at,
    };
  });
}

/**
 * Group per-machine session rows into ONE WorkoutRecord per training day
 * (session_date) — preserving the legacy "workout = gym visit" semantics
 * that the guardrail/coaching frequency + volume heuristics assume.
 *
 * - id: the session_date (stable, unique per day)
 * - started_at: earliest created_at that day
 * - finished_at: latest completed_at that day (null if none)
 * - one exercise per machine session, named after the machine
 *
 * Returns records sorted newest training day first.
 */
export function toWorkoutRecords(rows: SessionRow[]): WorkoutRecord[] {
  const byDate = new Map<string, SessionRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.session_date);
    if (list) list.push(row);
    else byDate.set(row.session_date, [row]);
  }

  const records: WorkoutRecord[] = [];
  for (const [date, dayRows] of byDate) {
    let earliestStart = dayRows[0].created_at;
    let latestFinish: string | null = null;
    for (const r of dayRows) {
      if (r.created_at < earliestStart) earliestStart = r.created_at;
      if (r.completed_at && (!latestFinish || r.completed_at > latestFinish)) {
        latestFinish = r.completed_at;
      }
    }

    records.push({
      id: date,
      started_at: earliestStart,
      finished_at: latestFinish,
      exercises: dayRows.map((r) => {
        const machine = joinedMachine(r);
        return {
          exercise_name: machine?.name ?? 'Machine',
          machine_id: r.machine_id,
          primary_muscles: machine?.muscle_groups ?? undefined,
          sets: parseSets(r),
        };
      }),
    });
  }

  // Newest first — guardrails/coaching expect newest-first ordering.
  records.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return records;
}

/**
 * Per-muscle "days since last trained" from recent session rows (any order).
 * Only muscles in `muscles` are reported; 0-day gaps (trained today) are
 * omitted to match the legacy muscle-gap contract.
 */
export function computeMuscleGaps(
  rows: SessionMachineRow[],
  muscles: Iterable<string>,
  now: number = Date.now(),
): Record<string, number> {
  // Newest session_date per muscle across all rows
  const latest = new Map<string, string>();
  for (const row of rows) {
    const machine = joinedMachine(row);
    for (const muscle of machine?.muscle_groups ?? []) {
      const prev = latest.get(muscle);
      if (!prev || row.session_date > prev) latest.set(muscle, row.session_date);
    }
  }

  const gaps: Record<string, number> = {};
  for (const muscle of muscles) {
    const date = latest.get(muscle);
    if (!date) continue;
    const daysAgo = Math.floor((now - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo > 0) gaps[muscle] = daysAgo;
  }
  return gaps;
}
