/**
 * Safety Nudge Ladder — escalating messages based on
 * discomfort/unstable feedback frequency.
 *
 * No medical advice. Uses safe phrasing only.
 */

export type NudgeLevel = 'gentle' | 'moderate' | 'strong';

export interface SafetyNudgeInput {
  /** Discomfort feedback count in last 7 days */
  discomfortCount7d: number;
  /** Unstable feedback count in last 7 days */
  unstableCount7d: number;
  /** Body areas with discomfort */
  topBodyAreas: string[];
  /** Current exercise name */
  exerciseName: string;
}

export interface SafetyNudge {
  level: NudgeLevel;
  message: string;
  /** When true, the AI suggestion should be suppressed or shown as secondary */
  should_suppress_suggestion: boolean;
}

export function getSafetyNudge(input: SafetyNudgeInput): SafetyNudge | null {
  const { discomfortCount7d, topBodyAreas, exerciseName } = input;

  if (discomfortCount7d <= 0) return null;

  const areaText = topBodyAreas.length > 0
    ? topBodyAreas.join(', ')
    : 'a body area';

  if (discomfortCount7d >= 3) {
    return {
      level: 'strong',
      message: `Repeated discomfort reported on ${areaText} (${discomfortCount7d}x this week). Consider skipping ${exerciseName} or consulting your trainer.`,
      should_suppress_suggestion: true,
    };
  }

  if (discomfortCount7d === 2) {
    return {
      level: 'moderate',
      message: `Multiple discomfort reports on ${areaText} recently. Consider a lighter load on ${exerciseName} or an alternative exercise.`,
      should_suppress_suggestion: false,
    };
  }

  return {
    level: 'gentle',
    message: `You reported discomfort on ${areaText} recently. Check in with your body before ${exerciseName}.`,
    should_suppress_suggestion: false,
  };
}
