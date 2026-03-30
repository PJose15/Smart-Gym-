// ─── Sunday Anticipation — UI_009 ──────────────────────────
// Pure functions for the 5:30-6:00pm Sunday window (Puerto Rico time).
// Used by heroState and web-admin.

const PR_TIMEZONE = 'America/Puerto_Rico';

function getPRTime(now?: Date): { dayOfWeek: string; hours: number; minutes: number } {
  const d = now ?? new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PR_TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { dayOfWeek: weekday, hours, minutes };
}

/**
 * Returns true if right now is Sunday between 5:30pm and 6:00pm PR time.
 */
export function isSundayAnticipation(now?: Date): boolean {
  const { dayOfWeek, hours, minutes } = getPRTime(now);
  if (dayOfWeek !== 'Sun') return false;
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 1050 && totalMinutes < 1080;
}

/**
 * Returns the number of minutes until 6:00pm PR time today (Sunday).
 * Returns 0 if past 6pm or not Sunday.
 */
export function getMinutesUntilSixPM(now?: Date): number {
  const { dayOfWeek, hours, minutes } = getPRTime(now);
  if (dayOfWeek !== 'Sun') return 0;
  const totalMinutes = hours * 60 + minutes;
  const target = 18 * 60;
  if (totalMinutes >= target) return 0;
  return target - totalMinutes;
}

/**
 * Combined check for heroState: returns anticipation status + countdown.
 */
export function checkSundayAnticipation(now?: Date): { anticipating: boolean; minutesUntil: number } {
  if (!isSundayAnticipation(now)) return { anticipating: false, minutesUntil: 0 };
  return { anticipating: true, minutesUntil: getMinutesUntilSixPM(now) };
}
