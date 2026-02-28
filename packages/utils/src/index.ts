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

// ─── Trend Computation Utils (Phase 2.6 — Charts) ──────

export interface TrendDataPoint {
  date: string;   // ISO date string (YYYY-MM-DD)
  value: number;
}

export interface SessionForTrend {
  startedAt: string;
  sets: Array<{ weight_kg: number; reps: number }>;
}

/**
 * Computes volume (sum of weight * reps) per session over time.
 */
export function computeVolumeTrend(sessions: SessionForTrend[]): TrendDataPoint[] {
  return sessions
    .map((s) => ({
      date: s.startedAt.slice(0, 10),
      value: s.sets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes best estimated 1RM per session over time.
 */
export function compute1RMTrend(sessions: SessionForTrend[]): TrendDataPoint[] {
  return sessions
    .map((s) => {
      let best = 0;
      for (const set of s.sets) {
        const e = estimate1RM(set.weight_kg, set.reps);
        if (e > best) best = e;
      }
      return { date: s.startedAt.slice(0, 10), value: best };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes best weight per session over time.
 */
export function computeWeightTrend(sessions: SessionForTrend[]): TrendDataPoint[] {
  return sessions
    .map((s) => {
      let best = 0;
      for (const set of s.sets) {
        if (set.weight_kg > best) best = set.weight_kg;
      }
      return { date: s.startedAt.slice(0, 10), value: best };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregates total volume by ISO week (YYYY-WXX format).
 */
export function computeWeeklyVolume(
  sessions: SessionForTrend[],
): TrendDataPoint[] {
  const weekMap = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const weekKey = getISOWeekKey(d);
    const vol = s.sets.reduce((sum, set) => sum + set.weight_kg * set.reps, 0);
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + vol);
  }
  return Array.from(weekMap.entries())
    .map(([date, value]) => ({ date, value: Math.round(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Computes workout count per ISO week.
 */
export function computeWeeklyFrequency(dates: string[]): TrendDataPoint[] {
  const weekMap = new Map<string, number>();
  for (const ds of dates) {
    const d = new Date(ds);
    const weekKey = getISOWeekKey(d);
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
  }
  return Array.from(weekMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Determines if a numeric series is trending up, down, or stable.
 */
export function computeTrendDirection(
  points: TrendDataPoint[],
): 'increasing' | 'decreasing' | 'stable' {
  if (points.length < 3) return 'stable';
  const mid = Math.floor(points.length / 2);
  const first = points.slice(0, mid);
  const second = points.slice(mid);
  const avgFirst = first.reduce((s, p) => s + p.value, 0) / first.length;
  const avgSecond = second.reduce((s, p) => s + p.value, 0) / second.length;
  const change = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;
  if (change > 0.05) return 'increasing';
  if (change < -0.05) return 'decreasing';
  return 'stable';
}

/** Returns ISO week key like "2026-W09" */
function getISOWeekKey(d: Date): string {
  const temp = new Date(d.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const yearStart = new Date(temp.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${temp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
