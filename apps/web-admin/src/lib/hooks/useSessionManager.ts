import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getNextSetSuggestion, toKg, fromKg } from '@nexera/ai-assist';
import type { NextSetSuggestion, WorkoutSet } from '@nexera/types';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import { enqueueSet } from '@/lib/stores/offlineQueueStore';

interface SetEntry {
  set_number: number;
  weight_lbs: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  logged_at: string;
}

interface SessionState {
  sessionId: string | null;
  sets: SetEntry[];
  setsCount: number;
  totalVolumeLbs: number;
  bestWeightLbs: number;
  bestReps: number;
  loading: boolean;
  error: string | null;
}

export function useSessionManager() {
  const { machine, member, sessionId, setSessionId } = useScanFlowStore();

  const [state, setState] = useState<SessionState>({
    sessionId: sessionId,
    sets: [],
    setsCount: 0,
    totalVolumeLbs: 0,
    bestWeightLbs: 0,
    bestReps: 0,
    loading: false,
    error: null,
  });

  // Fetch previous session's sets for this member + machine
  const [previousSets, setPreviousSets] = useState<WorkoutSet[]>([]);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!machine || !member) return;
    const key = `${member.id}:${machine.id}`;
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;

    fetch(`/api/member/${member.id}/sessions?machine_id=${machine.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const session = data?.sessions?.[0];
        if (session?.workout_sets?.length) {
          setPreviousSets(
            session.workout_sets.map((s: { id: string; set_number: number; reps: number; weight_kg?: number; weight_lbs?: number; rpe?: number | null; logged_at?: string }) => ({
              id: s.id,
              workout_exercise_id: '',
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg ?? toKg(s.weight_lbs ?? 0, 'lbs'),
              rpe: s.rpe ?? null,
              logged_at: s.logged_at ?? '',
            }))
          );
        }
      })
      .catch(() => { /* non-critical — suggestion still works without history */ });
  }, [machine, member]);

  // Get PR timezone session date
  const sessionDate = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Puerto_Rico',
    });
  }, []);

  // Determine weight increment based on machine category
  const weightIncrement = useMemo(() => {
    if (!machine) return 5;
    const lowerBody = ['quads', 'hamstrings', 'glutes', 'calves'];
    const isLowerBody = machine.muscle_groups.some((m) =>
      lowerBody.includes(m.toLowerCase())
    );
    return isLowerBody ? 10 : 5;
  }, [machine]);

  // Get progressive overload suggestion
  const suggestion: NextSetSuggestion | null = useMemo(() => {
    if (state.sets.length === 0 || !member) return null;

    try {
      // Convert logged sets to WorkoutSet format for ai-assist
      const currentSets: WorkoutSet[] = state.sets.map((s) => ({
        id: `set-${s.set_number}`,
        workout_exercise_id: '',
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: toKg(s.weight_lbs, 'lbs'),
        rpe: s.rpe,
        logged_at: s.logged_at,
      }));

      const result = getNextSetSuggestion({
        currentSets,
        previousSets,
        goal: (member.primary_goal as 'hypertrophy' | 'strength' | 'endurance' | 'general') || 'general',
        unit: 'lbs',
        experience: (member.experience_level as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
      });

      // Convert suggestion back to lbs
      return {
        ...result,
        suggested_weight:
          result.suggested_weight !== null
            ? Math.round(fromKg(result.suggested_weight, 'lbs') / weightIncrement) * weightIncrement
            : null,
      };
    } catch {
      return null;
    }
  }, [state.sets, member, weightIncrement, previousSets]);

  const logSet = useCallback(
    async (set: { weight_lbs: number; reps: number; rpe?: number | null; notes?: string }) => {
      if (!machine || !member) return;

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gym_id: machine.gym_id,
            machine_id: machine.id,
            member_id: member.id,
            session_date: sessionDate,
            workout_mode: 'free',
            set: {
              weight_lbs: set.weight_lbs,
              reps: set.reps,
              rpe: set.rpe ?? null,
              notes: set.notes || undefined,
            },
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setState((s) => ({ ...s, loading: false, error: data.error || 'Failed to log set' }));
          return null;
        }

        setSessionId(data.session_id);

        setState({
          sessionId: data.session_id,
          sets: data.sets,
          setsCount: data.sets_count,
          totalVolumeLbs: data.total_volume_lbs,
          bestWeightLbs: data.best_weight_lbs,
          bestReps: data.best_reps,
          loading: false,
          error: null,
        });

        return data;
      } catch {
        // Network failure — save to offline queue so the set isn't lost
        try {
          await enqueueSet({
            gym_id: machine.gym_id,
            machine_id: machine.id,
            member_id: member.id,
            session_date: sessionDate,
            workout_mode: 'free',
            set: {
              weight_lbs: set.weight_lbs,
              reps: set.reps,
              rpe: set.rpe ?? null,
            },
          });
          // Update UI optimistically so user sees the set was captured
          const newSetEntry: SetEntry = {
            set_number: state.sets.length + 1,
            weight_lbs: set.weight_lbs,
            reps: set.reps,
            rpe: set.rpe ?? null,
            notes: set.notes || null,
            logged_at: new Date().toISOString(),
          };
          const volume = set.weight_lbs * set.reps;
          setState((s) => ({
            ...s,
            sets: [...s.sets, newSetEntry],
            setsCount: s.setsCount + 1,
            totalVolumeLbs: s.totalVolumeLbs + volume,
            bestWeightLbs: Math.max(s.bestWeightLbs, set.weight_lbs),
            bestReps: Math.max(s.bestReps, set.reps),
            loading: false,
            error: 'Saved offline — will sync when connected.',
          }));
        } catch {
          setState((s) => ({
            ...s,
            loading: false,
            error: 'Network error. Try again.',
          }));
        }
        return null;
      }
    },
    [machine, member, sessionDate, setSessionId]
  );

  return {
    ...state,
    sessionDate,
    weightIncrement,
    suggestion,
    logSet,
  };
}
