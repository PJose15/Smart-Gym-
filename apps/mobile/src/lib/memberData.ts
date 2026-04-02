/**
 * Shared data fetching for profile-level member data.
 * Queries Supabase for level/XP, DNA result, and muscle map.
 */
import { supabase } from './supabase';
import { computeLevelProgress } from '@nexera/ai-assist';
import type { LevelProgress } from '@nexera/ai-assist';

// ─── Level / XP ─────────────────────────────────────────

export async function fetchMemberLevel(userId: string): Promise<LevelProgress | null> {
  const { data } = await supabase
    .from('gym_members')
    .select('smartgym_score')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle();

  if (!data || data.smartgym_score == null) return null;
  return computeLevelProgress(data.smartgym_score);
}

// ─── DNA Result ─────────────────────────────────────────

export interface DNACacheResult {
  archetype_key: string;
  archetype_name: string;
  archetype_color: string;
  archetype_icon: string;
  power: number;
  consistency: number;
  progression: number;
  balance: number;
  mindset: number;
  is_building: boolean;
  session_count: number;
  computed_at: string;
}

export async function fetchDNAResult(userId: string): Promise<DNACacheResult | null> {
  const { data } = await supabase
    .from('member_dna_cache')
    .select('result')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle();

  if (!data?.result) return null;
  return data.result as DNACacheResult;
}

// ─── Muscle Map ─────────────────────────────────────────

export interface MuscleMapEntry {
  key: string;
  label: string;
  state: 'fresh' | 'primed' | 'recovering' | 'fatigued';
  recovery_pct: number;
  last_trained_at: string | null;
}

export interface MuscleMapCacheResult {
  muscles: MuscleMapEntry[];
  balance_score: number;
  recommendations: {
    focus: string[];
    ready_to_train: string[];
  };
  computed_at: string;
}

export async function fetchMuscleMap(userId: string): Promise<MuscleMapCacheResult | null> {
  const { data } = await supabase
    .from('member_muscle_cache')
    .select('result')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle();

  if (!data?.result) return null;
  return data.result as MuscleMapCacheResult;
}
