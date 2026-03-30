import { SupabaseClient } from '@supabase/supabase-js';
import { checkBadgeUnlocks, computeLevel } from '@nexera/ai-assist';

export interface AchievementResult {
  newAchievements: Array<{ code: string; title: string; points: number }>;
  leveledUp: boolean;
  newLevel: { level: number; name: string; color: string } | null;
}

// Map badge slugs from ai-assist to achievement_definitions codes in DB
const SLUG_TO_CODE: Record<string, string> = {
  first_workout: 'first-scan',
  workouts_10: 'sessions-10',
  workouts_50: 'sessions-50',
  workouts_100: 'sessions-100',
  streak_4: 'streak-3',     // closest match
  streak_12: 'streak-14',   // closest match
  total_volume_10k: 'volume-10k',
  total_volume_100k: 'volume-100k',
  prs_5: 'prs-5',
  prs_25: 'prs-25',
  points_500: 'level-5',    // maps to level milestone
  points_5000: 'level-10',  // maps to level milestone
};

/**
 * Checks for new badge unlocks and level-ups after a session completes.
 * Gathers member stats, checks against badge rules, inserts new achievements,
 * creates gym feed events, and detects level changes.
 */
export async function checkAchievementsForMember(
  admin: SupabaseClient,
  member_id: string,
  gym_id: string,
  /** Score before the session started (before session points + badge points). If omitted, uses current DB score. */
  scoreBeforeSession?: number
): Promise<AchievementResult> {
  // Gather stats in parallel
  const [memberResult, sessionsResult, prsResult, volumeResult, achievementsResult] = await Promise.all([
    admin
      .from('members')
      .select('smartgym_score, current_streak, best_streak, display_name')
      .eq('id', member_id)
      .single(),
    admin
      .from('workout_sessions')
      .select('id')
      .eq('member_id', member_id)
      .not('completed_at', 'is', null),
    admin
      .from('workout_sessions')
      .select('id')
      .eq('member_id', member_id)
      .eq('is_personal_best', true),
    admin
      .from('workout_sessions')
      .select('total_volume_lbs')
      .eq('member_id', member_id)
      .not('completed_at', 'is', null),
    admin
      .from('member_achievements')
      .select('achievement_code')
      .eq('member_id', member_id),
  ]);

  const member = memberResult.data;
  if (!member) return { newAchievements: [], leveledUp: false, newLevel: null };

  const completedWorkouts = (sessionsResult.data || []).length;
  const totalPRs = (prsResult.data || []).length;
  const totalVolumeLbs = (volumeResult.data || []).reduce(
    (sum: number, s: { total_volume_lbs: number }) => sum + (s.total_volume_lbs || 0),
    0
  );
  const totalVolumeKg = totalVolumeLbs * 0.453592;

  // Map existing achievement codes back to slugs for the badge engine
  const existingCodes = (achievementsResult.data || []).map(
    (a: { achievement_code: string }) => a.achievement_code
  );
  const codeToSlug = Object.fromEntries(
    Object.entries(SLUG_TO_CODE).map(([slug, code]) => [code, slug])
  );
  const alreadyUnlockedSlugs = existingCodes
    .map((code: string) => codeToSlug[code])
    .filter(Boolean) as string[];

  // Check for new badges
  const newSlugs = checkBadgeUnlocks({
    completedWorkouts,
    currentStreak: member.current_streak || 0,
    longestStreak: member.best_streak || 0,
    totalVolumeKg,
    totalPRs,
    totalPoints: member.smartgym_score || 0,
    alreadyUnlockedSlugs,
  });

  // Use pre-session score for level comparison baseline, or current DB score if not provided
  const scoreBaseline = scoreBeforeSession ?? (member.smartgym_score || 0);
  const scoreBeforeBadges = member.smartgym_score || 0;

  if (newSlugs.length === 0) {
    // No badges — check if session points alone caused a level-up
    const levelResult = await checkLevelUp(admin, member_id, scoreBaseline, scoreBeforeBadges);
    return { newAchievements: [], ...levelResult };
  }

  // Map slugs to DB codes and look up definitions
  const newCodes = newSlugs
    .map((slug) => SLUG_TO_CODE[slug])
    .filter(Boolean);

  const { data: badges } = await admin
    .from('achievement_definitions')
    .select('code, title, points')
    .in('code', newCodes);

  const badgeMap = new Map(
    (badges || []).map((b: { code: string; title: string; points: number }) => [b.code, b])
  );
  const newAchievements: AchievementResult['newAchievements'] = [];
  let pointsEarned = 0;

  // Insert achievements and create feed events
  for (const code of newCodes) {
    const badge = badgeMap.get(code);
    const badgeTitle = badge?.title || code;
    const badgePoints = badge?.points || 25;

    // Insert member_achievements
    await admin.from('member_achievements').insert({
      member_id,
      gym_id,
      achievement_code: code,
      context_data: {},
    });

    // Create gym feed event
    await admin.from('gym_feed_events').insert({
      gym_id,
      member_id,
      event_type: 'achievement_earned',
      display_text: `${member.display_name || 'Member'} earned "${badgeTitle}"`,
      context_data: { achievement_code: code },
    });

    pointsEarned += badgePoints;
    newAchievements.push({
      code,
      title: badgeTitle,
      points: badgePoints,
    });
  }

  // Award bonus points for badge unlocks
  if (pointsEarned > 0) {
    const newScore = (member.smartgym_score || 0) + pointsEarned;
    await admin
      .from('members')
      .update({ smartgym_score: newScore })
      .eq('id', member_id);
  }

  // Check level-up: compare pre-session score to score after all points
  const levelResult = await checkLevelUp(
    admin,
    member_id,
    scoreBaseline,
    scoreBeforeBadges + pointsEarned
  );

  return {
    newAchievements,
    leveledUp: levelResult.leveledUp,
    newLevel: levelResult.newLevel,
  };
}

async function checkLevelUp(
  admin: SupabaseClient,
  member_id: string,
  scoreBefore: number,
  scoreAfter: number
): Promise<{ leveledUp: boolean; newLevel: { level: number; name: string; color: string } | null }> {
  const prevLevel = computeLevel(scoreBefore);
  const newLevel = computeLevel(scoreAfter);

  if (newLevel.level > prevLevel.level) {
    await admin
      .from('members')
      .update({ leveled_up_at: new Date().toISOString() })
      .eq('id', member_id);

    return {
      leveledUp: true,
      newLevel: { level: newLevel.level, name: newLevel.name, color: newLevel.color },
    };
  }

  return { leveledUp: false, newLevel: null };
}
