import type { WeightUnit } from '@smartgym/types';

const KG_TO_LBS = 2.20462;

/**
 * Convert weight between kg and lbs.
 */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'lbs') return Math.round(value * KG_TO_LBS * 10) / 10;
  return Math.round((value / KG_TO_LBS) * 10) / 10;
}

/** Convert from any unit to kg */
export function toKg(value: number, unit: WeightUnit): number {
  return convertWeight(value, unit, 'kg');
}

/** Convert from kg to display unit */
export function fromKg(kg: number, unit: WeightUnit): number {
  return convertWeight(kg, 'kg', unit);
}
