import { supabase } from './supabase';
import { computeStreak } from '@smartgym/ai-assist';
import { awardPoints } from './pointsService';
import type { StreakResult } from '@smartgym/ai-assist';

export type { StreakResult };

/**
 * Fetches the user's completed workout dates and computes streak info.
 */
export async function getStreak(
  profileId: string,
  gymId: string,
): Promise<StreakResult> {
  const { data, error } = await supabase
    .from('workouts')
    .select('started_at')
    .eq('profile_id', profileId)
    .eq('gym_id', gymId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false });

  if (error) throw error;

  const dates = (data ?? []).map((w: { started_at: string }) => w.started_at);
  return computeStreak({ completedWorkoutDates: dates });
}

/**
 * Checks if a streak bonus should be awarded this week and awards it.
 * Idempotent via reference_id = 'streak-{weekKey}'.
 */
export async function checkAndAwardStreakBonus(
  profileId: string,
  gymId: string,
): Promise<void> {
  try {
    const streak = await getStreak(profileId, gymId);

    if (!streak.shouldAwardBonus || streak.bonusPoints === 0) return;

    await awardPoints({
      profileId,
      gymId,
      points: streak.bonusPoints,
      reason: 'streak_bonus',
      referenceId: `streak-${streak.currentWeekKey}`,
    });
  } catch {
    // Non-fatal — streak bonus is a nice-to-have
  }
}
