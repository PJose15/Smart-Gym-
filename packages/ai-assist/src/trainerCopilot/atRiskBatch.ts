/**
 * At-Risk Member Detection for Trainer Co-Pilot.
 * Flags members who may need trainer attention based on
 * inactivity, repeated discomfort, or plateauing.
 */

// ─── Types ───────────────────────────────────────────────

export type AtRiskReason =
  | { type: 'no_workouts_7d'; daysSinceLastWorkout: number }
  | { type: 'repeated_discomfort'; count: number; bodyAreas: string[] }
  | { type: 'plateauing'; exerciseName: string; weeksSameWeight: number };

export interface AtRiskMember {
  profileId: string;
  memberName: string;
  reasons: AtRiskReason[];
}

export interface MemberData {
  profileId: string;
  memberName: string;
  /** ISO date of last workout, or null if never */
  lastWorkoutAt: string | null;
  /** Discomfort count in last 7 days */
  discomfortCount7d: number;
  /** Body areas with discomfort */
  discomfortBodyAreas: string[];
  /** Exercises where weight has not increased in N weeks */
  plateauExercises: Array<{ exerciseName: string; weeksSameWeight: number }>;
}

// ─── Constants ───────────────────────────────────────────

const INACTIVITY_THRESHOLD_DAYS = 7;
const DISCOMFORT_THRESHOLD = 3;
const PLATEAU_THRESHOLD_WEEKS = 3;

// ─── Main Function ───────────────────────────────────────

export function computeAtRiskMembers(members: MemberData[]): AtRiskMember[] {
  const results: AtRiskMember[] = [];

  for (const member of members) {
    const reasons: AtRiskReason[] = [];

    // 1) No workouts in 7+ days
    if (member.lastWorkoutAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(member.lastWorkoutAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince >= INACTIVITY_THRESHOLD_DAYS) {
        reasons.push({ type: 'no_workouts_7d', daysSinceLastWorkout: daysSince });
      }
    } else {
      // Never worked out — flag as inactive
      reasons.push({ type: 'no_workouts_7d', daysSinceLastWorkout: Infinity });
    }

    // 2) Repeated discomfort (>= 3 in 7 days)
    if (member.discomfortCount7d >= DISCOMFORT_THRESHOLD) {
      reasons.push({
        type: 'repeated_discomfort',
        count: member.discomfortCount7d,
        bodyAreas: member.discomfortBodyAreas,
      });
    }

    // 3) Plateauing (3+ weeks same weight on any exercise)
    for (const plateau of member.plateauExercises) {
      if (plateau.weeksSameWeight >= PLATEAU_THRESHOLD_WEEKS) {
        reasons.push({
          type: 'plateauing',
          exerciseName: plateau.exerciseName,
          weeksSameWeight: plateau.weeksSameWeight,
        });
      }
    }

    if (reasons.length > 0) {
      results.push({
        profileId: member.profileId,
        memberName: member.memberName,
        reasons,
      });
    }
  }

  return results;
}
