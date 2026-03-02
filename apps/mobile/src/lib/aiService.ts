/**
 * AI Service — calls the ai-generate edge function.
 * All LLM calls are proxied through the edge function so
 * the Gemini API key stays server-side.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────

export type AiErrorCode = 'AI_DISABLED' | 'RATE_LIMITED' | 'FEATURE_DISABLED' | 'NETWORK_ERROR' | 'UNKNOWN';

export interface AiServiceError {
  code: AiErrorCode;
  message: string;
}

export type AiServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AiServiceError };

// ─── Core invoke helper ──────────────────────────────────

async function invokeAi<T>(action: string, payload: Record<string, unknown>): Promise<AiServiceResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: { action, payload },
    });

    if (error) {
      const msg = error.message ?? '';
      const code: AiErrorCode = msg.includes('Rate limit') ? 'RATE_LIMITED'
        : msg.includes('Feature disabled') ? 'FEATURE_DISABLED'
        : msg.includes('not configured') ? 'AI_DISABLED'
        : 'UNKNOWN';
      return { ok: false, error: { code, message: msg } };
    }

    if (!data?.data) {
      return { ok: false, error: { code: 'UNKNOWN', message: 'Empty response from AI service' } };
    }

    return { ok: true, data: data.data as T };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

// ─── Public API ──────────────────────────────────────────

export async function fetchCoachingInsight(input: {
  memberName: string;
  contextSummary: string;
  gaps: string[];
  risks: string[];
  recentPRs: string[];
}): Promise<AiServiceResult<{ message: string; action_items: string[] }>> {
  return invokeAi('coaching_insight', input as unknown as Record<string, unknown>);
}

export async function fetchGeneratedProgram(input: {
  goal: string;
  experience: string;
  daysPerWeek: number;
  limitations: string[];
  availableMachines: Array<{ id: string; name: string; target_muscles: string[] }>;
}): Promise<AiServiceResult<{
  name: string;
  description: string;
  days: Array<{
    day_number: number;
    name: string;
    exercises: Array<{
      exercise_name: string;
      machine_id: string | null;
      default_sets: number;
      default_reps: number;
    }>;
  }>;
  overall_rationale: string;
}>> {
  return invokeAi('generate_program', input as unknown as Record<string, unknown>);
}
