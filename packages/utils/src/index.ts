/**
 * Formats a number with comma separators
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,000")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Formats a number with comma separators and optional "+" suffix
 * @param value - The number to format
 * @param showPlus - Whether to add "+" for large numbers
 * @returns Formatted string (e.g., "1,000+")
 */
export function formatStatValue(value: number, showPlus = false): string {
  const formatted = formatNumber(value);
  return showPlus && value >= 1000 ? `${formatted}+` : formatted;
}

/**
 * Parses a QR code string to extract machine slug
 * @param data - Raw QR code data
 * @returns Machine slug or null if invalid
 */
export function parseQrCode(data: string): string | null {
  // Expected format: "smartgym://machine/{slug}" or just the slug
  try {
    if (data.startsWith('smartgym://machine/')) {
      return data.replace('smartgym://machine/', '');
    }
    // Assume it's just a slug if it doesn't match the URL format
    // Validate it's alphanumeric with hyphens/underscores
    if (/^[a-zA-Z0-9_-]+$/.test(data)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate estimated 1RM using Brzycki formula.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}

/**
 * Calculate total volume from sets: sum(weight * reps).
 */
export function calculateVolume(
  sets: Array<{ weight_kg: number; reps: number }>,
): number {
  return sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
}

/**
 * Format a duration in minutes to a human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Determine which program day to show based on assignment date and today.
 * Cycles through days: (daysSinceAssignment % totalDays) + 1
 */
export function getTodaysProgramDay(
  assignedAt: string,
  totalDays: number,
): number {
  if (totalDays <= 0) return 1;
  const assigned = new Date(assignedAt);
  if (isNaN(assigned.getTime())) return 1; // Fallback for invalid dates
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24),
  );
  return (daysDiff % totalDays) + 1;
}

/**
 * Formats a weight value to a human-readable string.
 */
export function formatWeight(value: number, unit: string = 'kg'): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

/**
 * Converts a string to a URL-safe slug.
 * e.g. "Lat Pulldown" → "lat-pulldown"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generates a QR slug for a machine: "{gym-slug}-{machine-slug}"
 */
export function generateQrSlug(gymSlug: string, machineName: string): string {
  return `${generateSlug(gymSlug)}-${generateSlug(machineName)}`;
}
