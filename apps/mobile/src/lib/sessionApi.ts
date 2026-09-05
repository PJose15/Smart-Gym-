/**
 * Workout session API client — the single write path for mobile logging.
 * Mirrors the web scan flow: POST /api/sessions upserts one session per
 * (member, machine, day) and appends a set; complete awards points, streak,
 * achievements, feed events and cache refreshes server-side.
 *
 * All weights cross this boundary in POUNDS (canonical storage unit).
 */
import { apiFetch } from './api';
import { enqueueEvent } from './offlineQueue';

/** Queue table name used for offline set replays (not a real DB table). */
export const OFFLINE_SET_QUEUE_TABLE = 'api:log-set';

export type WorkoutMode = 'ai_program' | 'trainer_program' | 'free';

export interface SessionSetEntry {
  set_number: number;
  weight_lbs: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  logged_at: string;
}

export interface LogSetInput {
  gym_id: string;
  machine_id: string;
  member_id: string;
  session_date: string; // YYYY-MM-DD (device-local)
  workout_mode: WorkoutMode;
  set: {
    weight_lbs: number;
    reps: number;
    rpe?: number | null;
    notes?: string;
  };
}

export interface LogSetResult {
  session_id: string;
  set_number: number;
  sets: SessionSetEntry[];
  sets_count: number;
  total_volume_lbs: number;
  best_weight_lbs: number;
  best_reps: number;
}

export interface CompleteSessionResult {
  success: boolean;
  already_completed?: boolean;
  summary: {
    session_id: string;
    sets_count: number;
    total_volume_lbs: number;
    best_weight_lbs: number;
    is_personal_best: boolean;
    points_awarded: number;
    streak: number;
  };
  new_achievements?: Array<{ code: string; title: string; points: number }>;
  leveled_up?: boolean;
  new_level?: { level: number; name: string; color: string };
}

export interface PrResult {
  type: 'first_session' | 'weight' | 'volume';
  value: number;
  previousValue: number | null;
  improvementPct: number | null;
}

/** Device-local calendar date as YYYY-MM-DD. */
export function localSessionDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Log one set. On network failure the payload is queued for offline replay
 * and 'queued' is returned; 'unavailable' means no API base or session.
 */
export async function logSet(
  input: LogSetInput,
): Promise<LogSetResult | 'queued' | 'unavailable'> {
  try {
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res) return 'unavailable';
    if (!res.ok) throw new Error(`log-set ${res.status}`);
    return (await res.json()) as LogSetResult;
  } catch {
    await enqueueEvent(OFFLINE_SET_QUEUE_TABLE, input as unknown as Record<string, unknown>);
    return 'queued';
  }
}

/** Replay handler for the offline queue (pass to flushQueue). */
export async function replayQueuedSet(
  table: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (table !== OFFLINE_SET_QUEUE_TABLE) return false;
  try {
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

/** Complete a session; server awards points/streak/achievements/feed. */
export async function completeSession(
  sessionId: string,
  memberId: string,
): Promise<CompleteSessionResult | null> {
  try {
    const res = await apiFetch(`/api/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId }),
    });
    if (!res?.ok) return null;
    return (await res.json()) as CompleteSessionResult;
  } catch {
    return null;
  }
}

/** Check whether the latest set is a PR; server marks the session + feed. */
export async function prCheck(input: {
  session_id: string;
  member_id: string;
  machine_id: string;
  weight_lbs: number;
  reps: number;
}): Promise<PrResult | null> {
  try {
    const res = await apiFetch('/api/sessions/pr-check', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res?.ok) return null;
    const data = (await res.json()) as { pr: PrResult | null };
    return data.pr;
  } catch {
    return null;
  }
}
