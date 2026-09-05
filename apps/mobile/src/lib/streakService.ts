import { supabase } from './supabase';
import { computeStreak } from '@nexera/ai-assist';
import { awardPoints } from './pointsService';
import { getMemberId } from './memberData';
import type { StreakResult } from '@nexera/ai-assist';

export type { StreakResult };

/**
 * Fetches the member's completed session dates and computes streak info.
 *
 * `profileId` is the AUTH USER id (all callers pass `user.id`); the
 * members.id FK used by `workout_sessions` is resolved internally.
 */
export async function getStreak(
  profileId: string,
  gymId: string,
): Promise<StreakResult> {
  const memberId = await getMemberId(profileId);
  if (!memberId) {
    return computeStreak({ completedWorkoutDates: [] });
  }

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('session_date')
    .eq('member_id', memberId)
    .eq('gym_id', gymId)
    .not('completed_at', 'is', null)
    .order('session_date', { ascending: false });

  if (error) throw error;

  // Rows are per machine-per-day; dedupe to distinct training days.
  const dates = [
    ...new Set((data ?? []).map((s: { session_date: string }) => s.session_date)),
  ];
  return computeStreak({ completedWorkoutDates: dates });
}

/**
 * Checks if a streak bonus should be awarded this week and awards it.
 * Idempotent via reference_id = 'streak-{weekKey}'.
 */
export async function checkAndAwardStreakBonus(
  profileId: string,
  gymId: string,
): Promise<StreakResult | null> {
  try {
    const streak = await getStreak(profileId, gymId);

    if (!streak.shouldAwardBonus || streak.bonusPoints === 0) return streak;

    await awardPoints({
      profileId,
      gymId,
      points: streak.bonusPoints,
      reason: 'streak_bonus',
      referenceId: `streak-${streak.currentWeekKey}`,
    });

    return streak;
  } catch {
    // Non-fatal — streak bonus is a nice-to-have
    return null;
  }
}
