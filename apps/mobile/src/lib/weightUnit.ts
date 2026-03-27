import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit } from '@nexera/types';

const WEIGHT_UNIT_KEY = 'nexera_weight_unit';

/**
 * Reads the user's preferred weight unit from AsyncStorage.
 * Defaults to 'kg' if not set or unreadable.
 */
export async function getWeightUnit(): Promise<WeightUnit> {
    try {
        const saved = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
        if (saved === 'kg' || saved === 'lbs') return saved;
    } catch {
        // ignore storage errors
    }
    return 'kg';
}

/**
 * Persists the user's preferred weight unit to AsyncStorage.
 */
export async function saveWeightUnit(unit: WeightUnit): Promise<void> {
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

export { WEIGHT_UNIT_KEY };
