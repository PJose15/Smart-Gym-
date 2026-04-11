/**
 * Weight unit conversion + display helpers.
 *
 * All values are stored in the database as LBS. User preference is read from
 * `member_settings.weight_unit` and surfaced via `MemberContext`. Display code
 * should always go through these helpers so the user sees their preferred unit.
 */

export type WeightUnit = 'lbs' | 'kg';

/** 1 lb = 0.45359237 kg (exact by international agreement, 1959). */
const KG_PER_LB = 0.45359237;

/** Convert lbs → target unit. Returns a raw number (not formatted). */
export function convertFromLbs(lbs: number, unit: WeightUnit): number {
  return unit === 'kg' ? lbs * KG_PER_LB : lbs;
}

/** Convert a target-unit value back to lbs (for input forms). */
export function convertToLbs(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value / KG_PER_LB : value;
}

/**
 * Format a weight for display.
 *
 * Rounding rules:
 * - lbs: integer (no decimals — gyms use 5-lb plates)
 * - kg : 1 decimal when < 10, integer when ≥ 10 (standard metric plate handling)
 *
 * Usage:
 *   formatWeight(225, 'lbs')      // "225 lbs"
 *   formatWeight(225, 'kg')       // "102 kg"
 *   formatWeight(225, 'lbs', { showUnit: false }) // "225"
 */
export function formatWeight(
  lbs: number,
  unit: WeightUnit,
  opts: { showUnit?: boolean } = {}
): string {
  const showUnit = opts.showUnit ?? true;
  const value = convertFromLbs(lbs, unit);
  const rounded =
    unit === 'kg' && value < 10
      ? value.toFixed(1)
      : Math.round(value).toLocaleString();
  return showUnit ? `${rounded} ${unit}` : String(rounded);
}

/**
 * Format a large volume (total lifted) for display. Uses `k` suffix at scale.
 *
 *   formatVolume(125_000, 'lbs') // "125.0k lbs"
 *   formatVolume(125_000, 'kg')  // "56.7k kg"
 *   formatVolume(850, 'lbs')     // "850 lbs"
 */
export function formatVolume(lbs: number, unit: WeightUnit): string {
  const value = convertFromLbs(lbs, unit);
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ${unit}`;
  }
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

/** Short label for the unit — use when rendering a bare unit suffix. */
export function unitLabel(unit: WeightUnit): string {
  return unit;
}

/**
 * Reformat any `"<number> lbs"` substrings inside a text blob to the user's
 * preferred weight unit. Storage is always lbs and server-generated feed
 * descriptions bake `lbs` directly into the text, so this rewrites them at
 * render time for non-`lbs` viewers.
 *
 * Passes through unchanged when `unit === 'lbs'` or the text has no matches.
 * Numbers with commas (`12,500 lbs`) and decimals (`82.5 lbs`) are supported.
 *
 *   reformatWeightInText('Alice hit 225 lbs!', 'kg') // "Alice hit 102 kg!"
 *   reformatWeightInText('12,500 lbs', 'kg')          // "5,670 kg"
 *   reformatWeightInText('225 lbs', 'lbs')            // "225 lbs" (unchanged)
 */
export function reformatWeightInText(text: string, unit: WeightUnit): string {
  if (unit === 'lbs') return text;
  return text.replace(/([\d,]+(?:\.\d+)?)\s*lbs\b/g, (match, numStr: string) => {
    const lbs = parseFloat(numStr.replace(/,/g, ''));
    if (!Number.isFinite(lbs)) return match;
    const value = convertFromLbs(lbs, unit);
    const rounded = Math.round(value).toLocaleString();
    return `${rounded} ${unit}`;
  });
}
