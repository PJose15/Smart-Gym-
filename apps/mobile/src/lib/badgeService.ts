import { supabase } from './supabase';
import { checkBadgeUnlocks, computeStreak } from '@nexera/ai-assist';
import type { BadgeWithStatus } from '@nexera/types';

// ─── Rarity Display Constants ───────────────────────────

export const RARITY_COLORS: Record<string, string> = {
  common: '#B4B2A9',
  rare: '#3B8BD4',
  epic: '#7F77DD',
  legendary: '#D85A30',
};

export const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// ─── Service Functions ──────────────────────────────────

/**
 * Fetches all badge definitions and merges with user's unlock status.
 */
export async function getBadges(
  profileId: string,
  gymId: string,
): Promise<BadgeWithStatus[]> {
  const [{ data: badges, error: badgesErr }, { data: unlocks, error: unlocksErr }] = await Promise.all([
    supabase
      .from('badges')
      .select('*')
      .or(`gym_id.is.null,gym_id.eq.${gymId}`)
      .order('sort_order'),
    supabase
      .from('member_badges')
      .select('badge_id, unlocked_at')
      .eq('profile_id', profileId)
      .limit(500),
  ]);

  if (badgesErr) throw badgesErr;
  if (unlocksErr) throw unlocksErr;

  const unlockMap = new Map<string, string>();
  for (const u of unlocks ?? []) {
    unlockMap.set(u.badge_id, u.unlocked_at);
  }

  return (badges ?? []).map((badge) => ({
    ...badge,
    unlocked: unlockMap.has(badge.id),
    unlocked_at: unlockMap.get(badge.id) ?? null,
  })) as BadgeWithStatus[];
}

/**
 * Checks current stats and unlocks any newly earned badges.
 * Returns array of newly unlocked badge slugs.
 */
export async function checkAndUnlockBadges(
  profileId: string,
  gymId: string,
): Promise<string[]> {
  // Gather stats in parallel
  const [
    workoutCountResult,
    volumeResult,
    pointsResult,
    workoutDatesResult,
    prCountResult,
    existingBadgesResult,
  ] = await Promise.all([
    // Completed workout count
    supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('gym_id', gymId)
      .eq('status', 'completed'),
    // Total volume via RPC
    supabase.rpc('get_total_volume', { p_profile_id: profileId, p_gym_id: gymId }),
    // Total points
    supabase
      .from('points_ledger')
      .select('points')
      .eq('profile_id', profileId)
      .eq('gym_id', gymId),
    // Workout dates for streak
    supabase
      .from('workouts')
      .select('started_at')
      .eq('profile_id', profileId)
      .eq('gym_id', gymId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false }),
    // PR count
    supabase
      .from('points_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('gym_id', gymId)
      .eq('reason', 'pr_achieved'),
    // Already unlocked badge slugs
    supabase
      .from('member_badges')
      .select('badges(slug)')
      .eq('profile_id', profileId),
  ]);

  // Bail out if any critical query failed
  const queryError = workoutCountResult.error ?? volumeResult.error ?? pointsResult.error
    ?? workoutDatesResult.error ?? prCountResult.error ?? existingBadgesResult.error;
  if (queryError) {
    if (__DEV__) console.warn('[badges] stat query failed:', queryError.message);
    return [];
  }

  const completedWorkouts = workoutCountResult.count ?? 0;
  const totalVolumeKg = Number(volumeResult.data ?? 0);
  const totalPoints = (pointsResult.data ?? []).reduce(
    (sum: number, e: { points: number }) => sum + e.points, 0,
  );
  const dates = (workoutDatesResult.data ?? []).map(
    (w: { started_at: string }) => w.started_at,
  );
  const streakResult = computeStreak({ completedWorkoutDates: dates });
  const totalPRs = prCountResult.count ?? 0;

  const alreadyUnlockedSlugs = (existingBadgesResult.data ?? [])
    .map((mb: any) => mb.badges?.slug as string | undefined)
    .filter((s): s is string => Boolean(s));

  // Run the pure badge engine
  const newSlugs = checkBadgeUnlocks({
    completedWorkouts,
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak,
    totalVolumeKg,
    totalPRs,
    totalPoints,
    alreadyUnlockedSlugs,
  });

  if (newSlugs.length === 0) return [];

  // Look up badge IDs for the new slugs
  const { data: badgeDefs } = await supabase
    .from('badges')
    .select('id, slug')
    .in('slug', newSlugs);

  if (!badgeDefs || badgeDefs.length === 0) return [];

  // Insert member_badges (UNIQUE constraint handles duplicates)
  const inserts = badgeDefs.map((b) => ({
    gym_id: gymId,
    profile_id: profileId,
    badge_id: b.id,
  }));

  await supabase.from('member_badges').upsert(inserts, {
    onConflict: 'profile_id,badge_id',
    ignoreDuplicates: true,
  });

  return newSlugs;
}

/**
 * Returns badges unlocked within the last 24 hours (for home screen card).
 */
export async function getRecentUnlocks(
  profileId: string,
  gymId: string,
): Promise<BadgeWithStatus[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('member_badges')
    .select('badge_id, unlocked_at, badges(*)')
    .eq('profile_id', profileId)
    .eq('gym_id', gymId)
    .gte('unlocked_at', since)
    .order('unlocked_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((mb: any) => ({
    ...(mb.badges as Record<string, unknown>),
    unlocked: true,
    unlocked_at: mb.unlocked_at,
  })) as BadgeWithStatus[];
}
