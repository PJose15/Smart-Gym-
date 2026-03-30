import type { CheckInWeekData } from '@nexera/types';

/**
 * Template-based fallback check-in when AI generation fails or is unavailable.
 * Factually correct but less personalized than AI output.
 */
export function getFallbackCheckIn(data: CheckInWeekData): string {
  const sessionWord =
    data.sessions_this_week === 1 ? '1 session' : `${data.sessions_this_week} sessions`;

  const prLine =
    data.prs_this_week > 0
      ? ` You hit ${data.prs_this_week} personal record${data.prs_this_week > 1 ? 's' : ''} this week — that is real progress.`
      : '';

  const programLine = data.program_title
    ? ` You are${data.program_week_number ? ` in Week ${data.program_week_number} of` : ' on'} ${data.program_title}.`
    : '';

  // Comparison line
  let comparisonLine = '';
  if (data.sessions_last_week > 0) {
    if (data.sessions_this_week > data.sessions_last_week) {
      comparisonLine = ` That is ${data.sessions_this_week - data.sessions_last_week} more than last week.`;
    } else if (data.sessions_this_week < data.sessions_last_week) {
      comparisonLine = ` Last week you had ${data.sessions_last_week} — one step at a time.`;
    }
  }

  // Readiness line
  let readinessLine = '';
  if (data.avg_readiness_score !== null) {
    readinessLine = `\n\nYour readiness averaged ${data.avg_readiness_score} this week${data.dominant_readiness_zone ? ` — mostly in the ${data.dominant_readiness_zone} zone` : ''}.`;
  }

  // Focus line
  let focusLine =
    '\n\nKeep building the habit. Consistency is the foundation of everything else.';
  if (data.most_trained_muscles.length > 0 && data.undertrained_muscles.length > 0) {
    focusLine = `\n\nThis week, consider giving ${data.undertrained_muscles.join(' and ')} some extra attention.`;
  }

  return (
    `${data.member_first_name}, you logged ${sessionWord} this week` +
    ` for a total of ${data.total_volume_lbs.toLocaleString()} lbs.` +
    prLine +
    comparisonLine +
    programLine +
    readinessLine +
    focusLine +
    '\n\nSee you on the floor. — Your Nexera Coach'
  );
}
