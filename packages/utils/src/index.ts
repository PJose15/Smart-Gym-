/**
 * Generate a URL-safe slug from a string.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a QR slug for a machine: gym-slug + machine name + random suffix.
 */
export function generateQrSlug(gymSlug: string, machineName: string): string {
  const base = generateSlug(`${gymSlug}-${machineName}`);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Parse a SmartGym QR code value.
 * Accepts:
 *   - smartgym://machine/<slug>
 *   - https://<domain>/m/<slug>
 *   - plain slug string
 * Returns the slug or null if invalid.
 */
export function parseQrCode(raw: string): string | null {
  const trimmed = raw.trim();

  // Deep link: smartgym://machine/<slug>
  const deepLinkMatch = trimmed.match(/^smartgym:\/\/machine\/([a-z0-9-]+)$/i);
  if (deepLinkMatch) return deepLinkMatch[1];

  // Universal link: https://*/m/<slug>
  const universalLinkMatch = trimmed.match(/^https?:\/\/[^/]+\/m\/([a-z0-9-]+)$/i);
  if (universalLinkMatch) return universalLinkMatch[1];

  // Plain slug (alphanumeric + hyphens, min 3 chars)
  const plainSlugMatch = trimmed.match(/^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$/i);
  if (plainSlugMatch) return trimmed.toLowerCase();

  return null;
}

/**
 * Build the QR code value to encode for a machine.
 */
export function buildQrValue(qrSlug: string): string {
  return `smartgym://machine/${qrSlug}`;
}

/**
 * Format weight with unit.
 */
export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') {
    return `${Math.round(kg * 2.20462)} lbs`;
  }
  return `${kg} kg`;
}

/**
 * Validate an email address (basic check).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
