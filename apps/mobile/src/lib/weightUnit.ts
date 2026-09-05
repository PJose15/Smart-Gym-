/**
 * Member weight-unit preference.
 * Source of truth is `member_settings.weight_unit` (shared with the web PWA);
 * AsyncStorage only caches the last-known value for offline reads.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit } from '@nexera/types';
import { supabase } from './supabase';
import { getMemberId } from './memberData';

const WEIGHT_UNIT_KEY = 'nexera_weight_unit';
const DEFAULT_UNIT: WeightUnit = 'lbs';

let memo: WeightUnit | null = null;

async function readCache(): Promise<WeightUnit | null> {
  try {
    const saved = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
    if (saved === 'kg' || saved === 'lbs') return saved;
  } catch {
    // ignore storage errors
  }
  return null;
}

async function writeCache(unit: WeightUnit): Promise<void> {
  try {
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
  } catch {
    // ignore storage errors
  }
}

/**
 * Resolve the member's preferred weight unit.
 * First call per app session reads member_settings; later calls return the
 * memoized value. Falls back to the AsyncStorage cache, then 'lbs'.
 */
export async function getWeightUnit(): Promise<WeightUnit> {
  if (memo) return memo;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const memberId = await getMemberId(user.id);
      if (memberId) {
        const { data } = await supabase
          .from('member_settings')
          .select('weight_unit')
          .eq('member_id', memberId)
          .maybeSingle();
        if (data?.weight_unit === 'kg' || data?.weight_unit === 'lbs') {
          const unit: WeightUnit = data.weight_unit;
          memo = unit;
          await writeCache(unit);
          return unit;
        }
      }
    }
  } catch {
    // network/auth failure → fall through to cache
  }

  const cached = await readCache();
  memo = cached ?? DEFAULT_UNIT;
  return memo;
}

/** Persist the preference to member_settings (and the local cache). */
export async function saveWeightUnit(unit: WeightUnit): Promise<void> {
  memo = unit;
  await writeCache(unit);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const memberId = await getMemberId(user.id);
    if (!memberId) return;
    await supabase
      .from('member_settings')
      .upsert({ member_id: memberId, weight_unit: unit }, { onConflict: 'member_id' });
  } catch {
    // offline — the cached value still applies locally; server sync happens
    // next time the user toggles the setting while online
  }
}

/** Drop the in-memory + stored preference (call on sign-out). */
export async function clearWeightUnitCache(): Promise<void> {
  memo = null;
  try {
    await AsyncStorage.removeItem(WEIGHT_UNIT_KEY);
  } catch {
    // ignore storage errors
  }
}

export { WEIGHT_UNIT_KEY };
