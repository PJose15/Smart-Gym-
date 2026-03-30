/**
 * Week date utilities for the check-in system.
 * Pure functions, no dependencies. Inline date math per 8.1/8.2 pattern.
 */

/**
 * Returns the most recent Monday at 00:00 UTC.
 * If today is Monday, returns today.
 */
export function getMostRecentMonday(now?: Date): Date {
  const d = now ? new Date(now) : new Date();
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the Sunday end of the week (6 days after weekStart).
 */
export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
}

/**
 * Format a week range as "Mon DD – Mon DD" for display.
 */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const sm = months[weekStart.getUTCMonth()];
  const sd = weekStart.getUTCDate();
  const em = months[weekEnd.getUTCMonth()];
  const ed = weekEnd.getUTCDate();
  return sm === em
    ? `${sm} ${sd} – ${ed}`
    : `${sm} ${sd} – ${em} ${ed}`;
}

/**
 * Returns ISO date string (YYYY-MM-DD) from a Date.
 */
export function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}
