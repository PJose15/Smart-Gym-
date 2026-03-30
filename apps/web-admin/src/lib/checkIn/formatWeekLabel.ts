/**
 * Formats a week_start date string (YYYY-MM-DD) into a human-readable label.
 * Example: "2026-03-23" -> "Week of Mar 23"
 */
export function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `Week of ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
